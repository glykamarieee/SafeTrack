using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using GemBox.Document;
using GemBox.Spreadsheet;

//
// ============================================================
// SAFETRACK REPORT SERVICE
// GemBox.Document      -> PDF
// GemBox.Spreadsheet   -> Excel
// ============================================================
//

//
// GEMBOX LICENSE CONFIGURATION
//
// If you later purchase / receive real GemBox license keys,
// configure these environment variables:
//
// GEMBOX_DOCUMENT_LICENSE
// GEMBOX_SPREADSHEET_LICENSE
//
// Otherwise the service uses GemBox Free mode.
//
var documentLicense =
    Environment.GetEnvironmentVariable(
        "GEMBOX_DOCUMENT_LICENSE"
    )?.Trim();

var spreadsheetLicense =
    Environment.GetEnvironmentVariable(
        "GEMBOX_SPREADSHEET_LICENSE"
    )?.Trim();

if (string.IsNullOrWhiteSpace(documentLicense))
{
    documentLicense = "FREE-LIMITED-KEY";
}

if (string.IsNullOrWhiteSpace(spreadsheetLicense))
{
    spreadsheetLicense = "FREE-LIMITED-KEY";
}

GemBox.Document.ComponentInfo.SetLicense(
    documentLicense
);

//
// During development, allow reports larger than the
// GemBox.Document free limit.
//
// If a Professional license is configured, this event
// will not be needed because the free limit is not reached.
//
GemBox.Document.ComponentInfo.FreeLimitReached +=
    (_, eventArgs) =>
    {
        eventArgs.FreeLimitReachedAction =
            GemBox.Document.FreeLimitReachedAction
                .ContinueAsTrial;
    };

SpreadsheetInfo.SetLicense(
    spreadsheetLicense
);

//
// During development, allow spreadsheets larger than
// the GemBox.Spreadsheet free limit.
//
SpreadsheetInfo.FreeLimitReached +=
    (_, eventArgs) =>
    {
        eventArgs.FreeLimitReachedAction =
            GemBox.Spreadsheet.FreeLimitReachedAction
                .ContinueAsTrial;
    };

//
// ============================================================
// ASP.NET CORE
// ============================================================
//

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();

//
// SafeTrack reports can contain thousands of activity records,
// so allow a reasonably large request body.
//
builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize =
        50 * 1024 * 1024;
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

//
// ============================================================
// PRIVATE SAFETRACK SERVICE KEY
// ============================================================
//

var reportServiceKey =
    Environment.GetEnvironmentVariable(
        "REPORT_SERVICE_KEY"
    )?.Trim() ?? "";

//
// ============================================================
// ROOT / STATUS
// ============================================================
//

app.MapGet("/", () =>
{
    return Results.Ok(
        new
        {
            service =
                "SafeTrack Report Service",

            status =
                "running",

            pdf =
                "GemBox.Document",

            excel =
                "GemBox.Spreadsheet",

            secured =
                !string.IsNullOrWhiteSpace(
                    reportServiceKey
                )
        }
    );
});

//
// ============================================================
// HEALTH CHECK
// ============================================================
//

app.MapGet("/health", () =>
{
    return Results.Ok(
        new
        {
            ok = true,

            service =
                "SafeTrack Report Service",

            timestamp =
                DateTimeOffset.UtcNow
        }
    );
});

//
// ============================================================
// SAFETRACK REPORT GENERATION ENDPOINT
// ============================================================
//

app.MapPost(
    "/reports/generate",
    (
        HttpRequest httpRequest,
        SafeTrackReportRequest request
    ) =>
    {
        //
        // 1. VERIFY SERVER CONFIGURATION
        //
        if (
            string.IsNullOrWhiteSpace(
                reportServiceKey
            )
        )
        {
            return Results.Problem(
                title:
                    "SafeTrack report service is not configured.",

                detail:
                    "REPORT_SERVICE_KEY is missing.",

                statusCode: 500
            );
        }

        //
        // 2. VERIFY PRIVATE REQUEST KEY
        //
        var suppliedKey =
            httpRequest.Headers[
                "X-SafeTrack-Report-Key"
            ]
            .FirstOrDefault();

        if (
            string.IsNullOrWhiteSpace(
                suppliedKey
            )
            ||
            !SecureEquals(
                reportServiceKey,
                suppliedKey
            )
        )
        {
            return Results.Unauthorized();
        }

        //
        // 3. VALIDATE REPORT FORMAT
        //
        var format =
            (
                request.Format
                ?? "pdf"
            )
            .Trim()
            .ToLowerInvariant();

        if (
            format != "pdf"
            &&
            format != "xlsx"
        )
        {
            return Results.BadRequest(
                new
                {
                    error =
                        "Report format must be pdf or xlsx."
                }
            );
        }

        //
        // 4. REPORT TITLE
        //
        var title =
            string.IsNullOrWhiteSpace(
                request.ReportTitle
            )
                ? "SafeTrack Activity Report"
                : request.ReportTitle.Trim();

        if (title.Length > 180)
        {
            title =
                title[..180];
        }

        //
        // 5. ACTIVITY RECORDS
        //
        var locations =
            request.Locations
            ?? Array.Empty<JsonElement>();

        var events =
            request.Events
            ?? Array.Empty<JsonElement>();

        var sos =
            request.Sos
            ?? Array.Empty<JsonElement>();

        var recordCount =
            locations.Length
            + events.Length
            + sos.Length;

        if (recordCount == 0)
        {
            return Results.BadRequest(
                new
                {
                    error =
                        "There are no activity records to export."
                }
            );
        }

        //
        // 6. GENERATE REPORT
        //
        try
        {
            if (format == "pdf")
            {
                var pdfBytes =
                    BuildPdfReport(
                        title,
                        request.DateFrom,
                        request.DateTo,
                        locations,
                        events,
                        sos
                    );

                return Results.File(
                    pdfBytes,
                    "application/pdf",
                    BuildFileName(
                        "pdf",
                        request.DateFrom,
                        request.DateTo
                    )
                );
            }

            var excelBytes =
                BuildExcelReport(
                    title,
                    request.DateFrom,
                    request.DateTo,
                    locations,
                    events,
                    sos
                );

            return Results.File(
                excelBytes,

                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

                BuildFileName(
                    "xlsx",
                    request.DateFrom,
                    request.DateTo
                )
            );
        }
        catch (Exception error)
        {
            Console.Error.WriteLine(
                "[report-service] " +
                error
            );

            return Results.Problem(
                title:
                    "SafeTrack report generation failed.",

                detail:
                    error.Message,

                statusCode: 500
            );
        }
    }
);

app.Run();

//
// ============================================================
// SECURITY
// ============================================================
//

static bool SecureEquals(
    string expected,
    string supplied
)
{
    var expectedBytes =
        Encoding.UTF8.GetBytes(
            expected
        );

    var suppliedBytes =
        Encoding.UTF8.GetBytes(
            supplied
        );

    if (
        expectedBytes.Length
        != suppliedBytes.Length
    )
    {
        return false;
    }

    return CryptographicOperations
        .FixedTimeEquals(
            expectedBytes,
            suppliedBytes
        );
}

//
// ============================================================
// PDF REPORT
// ============================================================
//

static byte[] BuildPdfReport(
    string title,
    string? dateFrom,
    string? dateTo,
    JsonElement[] locations,
    JsonElement[] events,
    JsonElement[] sos
)
{
    var document =
        new DocumentModel();

    var section =
        new Section(document);

    document.Sections.Add(
        section
    );

    var totalRecords =
        locations.Length
        + events.Length
        + sos.Length;

    //
    // HEADER
    //
    AddPdfParagraph(
        document,
        section,
        "SAFETRACK"
    );

    AddPdfParagraph(
        document,
        section,
        title
    );

    AddPdfParagraph(
        document,
        section,
        "Administrator Activity Report"
    );

    AddPdfParagraph(
        document,
        section,
        $"Selected Period: {DisplayDate(dateFrom)} to {DisplayDate(dateTo)}"
    );

    AddPdfParagraph(
        document,
        section,
        $"Generated: {FormatPhilippineTimestamp(DateTimeOffset.UtcNow)}"
    );

    AddPdfParagraph(
        document,
        section,
        ""
    );

    //
    // SUMMARY
    //
    AddPdfParagraph(
        document,
        section,
        "REPORT SUMMARY"
    );

    AddPdfParagraph(
        document,
        section,
        $"Total Activity Records: {totalRecords}"
    );

    AddPdfParagraph(
        document,
        section,
        $"Location Records: {locations.Length}"
    );

    AddPdfParagraph(
        document,
        section,
        $"Safe-Zone / Safety Events: {events.Length}"
    );

    AddPdfParagraph(
        document,
        section,
        $"SOS Records: {sos.Length}"
    );

    AddPdfParagraph(
        document,
        section,
        ""
    );

    //
    // LOCATION RECORDS
    //
    AddPdfParagraph(
        document,
        section,
        $"LOCATION RECORDS ({locations.Length})"
    );

    if (locations.Length == 0)
    {
        AddPdfParagraph(
            document,
            section,
            "No location records were found for the selected period."
        );
    }
    else
    {
        foreach (
            var location
            in locations
        )
        {
            var recordedAt =
                FormatJsonTimestamp(
                    location,
                    "recorded_at"
                );

            var source =
                GetJsonText(
                    location,
                    "source"
                );

            var latitude =
                GetJsonText(
                    location,
                    "latitude"
                );

            var longitude =
                GetJsonText(
                    location,
                    "longitude"
                );

            var accuracy =
                GetJsonText(
                    location,
                    "accuracy_meters"
                );

            var label =
                GetJsonText(
                    location,
                    "location_label"
                );

            var line =
                $"{recordedAt} | " +
                $"Source: {EmptyFallback(source)} | " +
                $"Location: {EmptyFallback(latitude)}, {EmptyFallback(longitude)}";

            if (
                !string.IsNullOrWhiteSpace(
                    accuracy
                )
            )
            {
                line +=
                    $" | Accuracy: {accuracy} m";
            }

            if (
                !string.IsNullOrWhiteSpace(
                    label
                )
            )
            {
                line +=
                    $" | {label}";
            }

            AddPdfParagraph(
                document,
                section,
                line
            );
        }
    }

    AddPdfParagraph(
        document,
        section,
        ""
    );

    //
    // SAFE-ZONE / SAFETY EVENTS
    //
    AddPdfParagraph(
        document,
        section,
        $"SAFE-ZONE / SAFETY EVENTS ({events.Length})"
    );

    if (events.Length == 0)
    {
        AddPdfParagraph(
            document,
            section,
            "No safe-zone or safety events were found for the selected period."
        );
    }
    else
    {
        foreach (
            var safetyEvent
            in events
        )
        {
            var occurredAt =
                FormatJsonTimestamp(
                    safetyEvent,
                    "occurred_at"
                );

            var eventType =
                GetJsonText(
                    safetyEvent,
                    "event_type"
                );

            var eventTitle =
                GetJsonText(
                    safetyEvent,
                    "title"
                );

            var details =
                GetJsonText(
                    safetyEvent,
                    "details"
                );

            var anomalyScore =
                GetJsonText(
                    safetyEvent,
                    "anomaly_score"
                );

            var latitude =
                GetJsonText(
                    safetyEvent,
                    "latitude"
                );

            var longitude =
                GetJsonText(
                    safetyEvent,
                    "longitude"
                );

            var line =
                $"{occurredAt} | " +
                $"Type: {EmptyFallback(eventType)}";

            if (
                !string.IsNullOrWhiteSpace(
                    eventTitle
                )
            )
            {
                line +=
                    $" | {eventTitle}";
            }

            if (
                !string.IsNullOrWhiteSpace(
                    anomalyScore
                )
            )
            {
                line +=
                    $" | Anomaly Score: {anomalyScore}";
            }

            if (
                !string.IsNullOrWhiteSpace(
                    latitude
                )
                ||
                !string.IsNullOrWhiteSpace(
                    longitude
                )
            )
            {
                line +=
                    $" | Location: {latitude}, {longitude}";
            }

            if (
                !string.IsNullOrWhiteSpace(
                    details
                )
            )
            {
                line +=
                    $" | Details: {details}";
            }

            AddPdfParagraph(
                document,
                section,
                line
            );
        }
    }

    AddPdfParagraph(
        document,
        section,
        ""
    );

    //
    // SOS RECORDS
    //
    AddPdfParagraph(
        document,
        section,
        $"SOS RECORDS ({sos.Length})"
    );

    if (sos.Length == 0)
    {
        AddPdfParagraph(
            document,
            section,
            "No SOS records were found for the selected period."
        );
    }
    else
    {
        foreach (
            var sosRecord
            in sos
        )
        {
            var triggeredAt =
                FormatJsonTimestamp(
                    sosRecord,
                    "triggered_at"
                );

            var status =
                GetJsonText(
                    sosRecord,
                    "status"
                );

            var activationMethod =
                GetJsonText(
                    sosRecord,
                    "activation_method"
                );

            var acknowledgedAt =
                FormatJsonTimestamp(
                    sosRecord,
                    "acknowledged_at"
                );

            var line =
                $"{triggeredAt} | " +
                $"Status: {EmptyFallback(status)}";

            if (
                !string.IsNullOrWhiteSpace(
                    activationMethod
                )
            )
            {
                line +=
                    $" | Activation: {activationMethod}";
            }

            line +=
                $" | Acknowledged: " +
                (
                    string.IsNullOrWhiteSpace(
                        acknowledgedAt
                    )
                        ? "No"
                        : acknowledgedAt
                );

            AddPdfParagraph(
                document,
                section,
                line
            );
        }
    }

    AddPdfParagraph(
        document,
        section,
        ""
    );

    //
    // DISCLAIMER
    //
    AddPdfParagraph(
        document,
        section,
        "SafeTrack reports summarize successfully stored system records. " +
        "They do not independently confirm danger, an emergency, or a " +
        "child's exact real-time position."
    );

    using var stream =
        new MemoryStream();

    document.Save(
        stream,
        GemBox.Document
            .SaveOptions
            .PdfDefault
    );

    return stream.ToArray();
}

//
// ============================================================
// EXCEL REPORT
// ============================================================
//

static byte[] BuildExcelReport(
    string title,
    string? dateFrom,
    string? dateTo,
    JsonElement[] locations,
    JsonElement[] events,
    JsonElement[] sos
)
{
    var workbook =
        new ExcelFile();

    CreateSummarySheet(
        workbook,
        title,
        dateFrom,
        dateTo,
        locations.Length,
        events.Length,
        sos.Length
    );

    CreateJsonSheet(
        workbook,
        "Location Logs",
        locations
    );

    CreateJsonSheet(
        workbook,
        "Safety Events",
        events
    );

    CreateJsonSheet(
        workbook,
        "SOS Alerts",
        sos
    );

    using var stream =
        new MemoryStream();

    workbook.Save(
        stream,
        GemBox.Spreadsheet
            .SaveOptions
            .XlsxDefault
    );

    return stream.ToArray();
}

//
// ============================================================
// EXCEL SUMMARY SHEET
// ============================================================
//

static void CreateSummarySheet(
    ExcelFile workbook,
    string title,
    string? dateFrom,
    string? dateTo,
    int locationCount,
    int eventCount,
    int sosCount
)
{
    var worksheet =
        workbook.Worksheets.Add(
            "Summary"
        );

    worksheet.Cells["A1"].Value =
        "SafeTrack Activity Report";

    worksheet.Cells["A2"].Value =
        title;

    worksheet.Cells["A4"].Value =
        "Selected Start Date";

    worksheet.Cells["B4"].Value =
        DisplayDate(
            dateFrom
        );

    worksheet.Cells["A5"].Value =
        "Selected End Date";

    worksheet.Cells["B5"].Value =
        DisplayDate(
            dateTo
        );

    worksheet.Cells["A6"].Value =
        "Generated";

    worksheet.Cells["B6"].Value =
        FormatPhilippineTimestamp(
            DateTimeOffset.UtcNow
        );

    worksheet.Cells["A8"].Value =
        "Record Type";

    worksheet.Cells["B8"].Value =
        "Total";

    worksheet.Cells["A9"].Value =
        "Location Records";

    worksheet.Cells["B9"].Value =
        locationCount;

    worksheet.Cells["A10"].Value =
        "Safe-Zone / Safety Events";

    worksheet.Cells["B10"].Value =
        eventCount;

    worksheet.Cells["A11"].Value =
        "SOS Records";

    worksheet.Cells["B11"].Value =
        sosCount;

    worksheet.Cells["A12"].Value =
        "Total Activity Records";

    worksheet.Cells["B12"].Value =
        locationCount
        + eventCount
        + sosCount;

    worksheet.Cells["A14"].Value =
        "Notice";

    worksheet.Cells["B14"].Value =
        "SafeTrack reports summarize successfully stored system records.";

    worksheet.Columns[0].AutoFit();
    worksheet.Columns[1].AutoFit();
}

//
// ============================================================
// EXCEL DATABASE RECORD SHEETS
// ============================================================
//

static void CreateJsonSheet(
    ExcelFile workbook,
    string sheetName,
    JsonElement[] rows
)
{
    var worksheet =
        workbook.Worksheets.Add(
            sheetName
        );

    if (rows.Length == 0)
    {
        worksheet.Cells[
            "A1"
        ].Value =
            "No records found.";

        worksheet.Columns[
            0
        ].AutoFit();

        return;
    }

    var columnNames =
        GetColumnNames(
            rows
        );

    //
    // COLUMN HEADERS
    //
    for (
        var columnIndex = 0;
        columnIndex <
            columnNames.Count;
        columnIndex++
    )
    {
        worksheet.Cells[
            0,
            columnIndex
        ].Value =
            columnNames[
                columnIndex
            ];
    }

    //
    // DATA ROWS
    //
    for (
        var rowIndex = 0;
        rowIndex < rows.Length;
        rowIndex++
    )
    {
        var row =
            rows[rowIndex];

        for (
            var columnIndex = 0;
            columnIndex <
                columnNames.Count;
            columnIndex++
        )
        {
            var columnName =
                columnNames[
                    columnIndex
                ];

            if (
                row.ValueKind
                    ==
                    JsonValueKind.Object
                &&
                row.TryGetProperty(
                    columnName,
                    out var value
                )
            )
            {
                worksheet.Cells[
                    rowIndex + 1,
                    columnIndex
                ].Value =
                    JsonToCellValue(
                        value
                    );
            }
            else
            {
                worksheet.Cells[
                    rowIndex + 1,
                    columnIndex
                ].Value = "";
            }
        }
    }

    //
    // AUTO SIZE COLUMNS
    //
    for (
        var columnIndex = 0;
        columnIndex <
            columnNames.Count;
        columnIndex++
    )
    {
        worksheet.Columns[
            columnIndex
        ].AutoFit();
    }
}

//
// ============================================================
// JSON COLUMN DISCOVERY
// ============================================================
//

static List<string> GetColumnNames(
    JsonElement[] rows
)
{
    var columns =
        new List<string>();

    var seen =
        new HashSet<string>(
            StringComparer
                .OrdinalIgnoreCase
        );

    foreach (
        var row
        in rows
    )
    {
        if (
            row.ValueKind
                !=
                JsonValueKind.Object
        )
        {
            continue;
        }

        foreach (
            var property
            in row.EnumerateObject()
        )
        {
            if (
                seen.Add(
                    property.Name
                )
            )
            {
                columns.Add(
                    property.Name
                );
            }
        }
    }

    return columns;
}

//
// ============================================================
// JSON -> EXCEL CELL
// ============================================================
//

static object JsonToCellValue(
    JsonElement value
)
{
    return value.ValueKind switch
    {
        JsonValueKind.String =>
            value.GetString()
            ?? "",

        JsonValueKind.Number
            when
                value.TryGetInt64(
                    out var integerValue
                ) =>
            integerValue,

        JsonValueKind.Number
            when
                value.TryGetDouble(
                    out var doubleValue
                ) =>
            doubleValue,

        JsonValueKind.True =>
            true,

        JsonValueKind.False =>
            false,

        JsonValueKind.Null =>
            "",

        JsonValueKind.Undefined =>
            "",

        JsonValueKind.Object =>
            value.GetRawText(),

        JsonValueKind.Array =>
            value.GetRawText(),

        _ =>
            value.ToString()
    };
}

//
// ============================================================
// JSON FIELD READER
// ============================================================
//

static string GetJsonText(
    JsonElement row,
    string propertyName
)
{
    if (
        row.ValueKind
            !=
            JsonValueKind.Object
    )
    {
        return "";
    }

    if (
        !row.TryGetProperty(
            propertyName,
            out var value
        )
    )
    {
        return "";
    }

    return value.ValueKind switch
    {
        JsonValueKind.String =>
            value.GetString()
            ?? "",

        JsonValueKind.Null =>
            "",

        JsonValueKind.Undefined =>
            "",

        JsonValueKind.Object =>
            value.GetRawText(),

        JsonValueKind.Array =>
            value.GetRawText(),

        _ =>
            value.ToString()
    };
}

//
// ============================================================
// TIMESTAMP READER
// ============================================================
//

static string FormatJsonTimestamp(
    JsonElement row,
    string propertyName
)
{
    var raw =
        GetJsonText(
            row,
            propertyName
        );

    if (
        string.IsNullOrWhiteSpace(
            raw
        )
    )
    {
        return "";
    }

    if (
        !DateTimeOffset.TryParse(
            raw,
            out var timestamp
        )
    )
    {
        return raw;
    }

    return FormatPhilippineTimestamp(
        timestamp
    );
}

//
// ============================================================
// PHILIPPINE TIMESTAMP
// ============================================================
//

static string FormatPhilippineTimestamp(
    DateTimeOffset timestamp
)
{
    try
    {
        TimeZoneInfo philippineTimeZone;

        try
        {
            philippineTimeZone =
                TimeZoneInfo
                    .FindSystemTimeZoneById(
                        "Singapore Standard Time"
                    );
        }
        catch
        {
            philippineTimeZone =
                TimeZoneInfo
                    .FindSystemTimeZoneById(
                        "Asia/Manila"
                    );
        }

        var local =
            TimeZoneInfo
                .ConvertTime(
                    timestamp,
                    philippineTimeZone
                );

        return local.ToString(
            "yyyy-MM-dd hh:mm tt"
        );
    }
    catch
    {
        return timestamp.ToString(
            "yyyy-MM-dd HH:mm:ss zzz"
        );
    }
}

//
// ============================================================
// PDF PARAGRAPH
// ============================================================
//

static void AddPdfParagraph(
    DocumentModel document,
    Section section,
    string text
)
{
    section.Blocks.Add(
        new Paragraph(
            document,
            text
        )
    );
}

//
// ============================================================
// REPORT FILENAME
// ============================================================
//

static string BuildFileName(
    string extension,
    string? dateFrom,
    string? dateTo
)
{
    var from =
        SafeFilePart(
            dateFrom
            ?? "start"
        );

    var to =
        SafeFilePart(
            dateTo
            ?? "end"
        );

    return
        $"SafeTrack_Activity_Report_{from}_to_{to}.{extension}";
}

//
// ============================================================
// SAFE FILENAME
// ============================================================
//

static string SafeFilePart(
    string value
)
{
    var invalidCharacters =
        Path.GetInvalidFileNameChars();

    return new string(
        value
            .Where(
                character =>
                    !invalidCharacters
                        .Contains(
                            character
                        )
            )
            .ToArray()
    );
}

//
// ============================================================
// DISPLAY DATE
// ============================================================
//

static string DisplayDate(
    string? value
)
{
    return
        string.IsNullOrWhiteSpace(
            value
        )
            ? "Not specified"
            : value;
}

//
// ============================================================
// EMPTY VALUE FALLBACK
// ============================================================
//

static string EmptyFallback(
    string? value
)
{
    return
        string.IsNullOrWhiteSpace(
            value
        )
            ? "-"
            : value;
}

//
// ============================================================
// REQUEST MODEL
// ============================================================
//

public sealed class SafeTrackReportRequest
{
    public string? Format
    {
        get;
        set;
    }

    public string? ReportTitle
    {
        get;
        set;
    }

    public string? ChildId
    {
        get;
        set;
    }

    public string? DateFrom
    {
        get;
        set;
    }

    public string? DateTo
    {
        get;
        set;
    }

    public JsonElement[]? Locations
    {
        get;
        set;
    }

    public JsonElement[]? Events
    {
        get;
        set;
    }

    public JsonElement[]? Sos
    {
        get;
        set;
    }
}