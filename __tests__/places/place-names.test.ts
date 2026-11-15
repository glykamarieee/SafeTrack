/**
 * Place names on the place card: OpenStreetMap first, Mapbox only for a
 * missing street, and never a made-up address.
 *
 * Nothing here reaches a server: the database and both lookups are replaced,
 * so the tests add no rows and use none of the free allowances.
 */
const mockRpc = jest.fn((_name: string, _args: unknown) => Promise.resolve({ data: null, error: null }));

jest.mock("../../lib/supabase", () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) }),
    rpc: (name: string, args: unknown) => mockRpc(name, args),
    // The shared test setup signs out after each file.
    auth: { signOut: () => Promise.resolve({ error: null }) },
  },
}));

import { AT_PLACE_M, checkSpot, placeFor, withMapboxStreet } from "../../lib/places";

type Answer = { ok?: boolean; body?: unknown; fail?: boolean };

/** Answers each lookup by address: Nominatim's address, its landmark layer, Mapbox. */
function answer({ osm, landmark, mapbox }: { osm: Answer; landmark?: Answer; mapbox?: Answer }) {
  const calls = { osm: 0, mapbox: 0 };
  globalThis.fetch = jest.fn(async (input: unknown) => {
    const url = String(input);
    const isMapbox = url.includes("api.mapbox.com");
    if (isMapbox) calls.mapbox += 1;
    else calls.osm += 1;
    const chosen = isMapbox ? mapbox : url.includes("layer=") ? landmark ?? { body: {} } : osm;
    if (!chosen || chosen.fail) throw new Error("network down");
    return { ok: chosen.ok ?? true, status: chosen.ok === false ? 500 : 200, json: async () => chosen.body } as Response;
  }) as unknown as typeof fetch;
  return calls;
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 1500));

const OSM_SCHOOL = {
  name: "University of Cebu - Lapu-Lapu Mandaue Campus",
  address: { road: "A.C. Cortes Avenue", suburb: "Looc", city: "Mandaue", state: "Central Visayas" },
};
const OSM_NO_STREET = { name: "", address: { neighbourhood: "La Aldea del Mar", suburb: "Babag", city: "Lapu-Lapu", state: "Central Visayas" } };
const OSM_HIGHWAY = { road: "Manuel L. Quezon National Highway", neighbourhood: "Bombshell", suburb: "Babag", city: "Lapu-Lapu", region: "Central Visayas" };
const MAPBOX_STREET = {
  features: [{ properties: { context: { street: { name: "Park Place Avenue" }, locality: { name: "Babag" }, place: { name: "Lapu-Lapu" } } } }],
};

beforeAll(() => {
  process.env.EXPO_PUBLIC_MAPBOX_TOKEN = "pk.test";
});

beforeEach(() => mockRpc.mockClear());

describe("place names", () => {
  jest.setTimeout(20_000);

  it("uses OpenStreetMap's named place and does not ask Mapbox", async () => {
    const calls = answer({ osm: { body: OSM_SCHOOL }, mapbox: { body: MAPBOX_STREET } });
    const place = await placeFor(10.3254, 123.9538);
    expect(place?.label).toBe("University of Cebu - Lapu-Lapu Mandaue Campus, Brgy. Looc, Mandaue City");
    expect(place?.mapbox).toBeUndefined();
    await settle();
    expect(calls.mapbox).toBe(0);
    expect(mockRpc).toHaveBeenCalledWith("save_location_place", expect.anything());
  });

  it("adds Mapbox's street where OpenStreetMap has none, and does not save it", async () => {
    const calls = answer({ osm: { body: OSM_NO_STREET }, mapbox: { body: MAPBOX_STREET } });
    const place = await placeFor(10.2727, 123.9425);
    expect(place?.label).toBe("Park Place Avenue, Brgy. Babag, Lapu-Lapu City");
    expect(place?.mapbox).toBe(true);
    await settle();
    expect(calls.mapbox).toBe(1);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("shows what OpenStreetMap gave when Mapbox fails", async () => {
    answer({ osm: { body: OSM_NO_STREET }, mapbox: { fail: true } });
    const place = await placeFor(10.2747, 123.9445);
    expect(place?.label).toBe("Brgy. Babag, Lapu-Lapu City");
    expect(place?.mapbox).toBeUndefined();
  });

  it("shows what OpenStreetMap gave when Mapbox answers with an error", async () => {
    answer({ osm: { body: OSM_NO_STREET }, mapbox: { ok: false, body: {} } });
    const place = await placeFor(10.2767, 123.9465);
    expect(place?.label).toBe("Brgy. Babag, Lapu-Lapu City");
  });

  // 2026-11-15: at Babag Barangay Hall the card said "Manuel L. Quezon National
  // Highway", because the cell was first looked up from a point on the highway.
  it("names the place the child is at, from the child's exact point", async () => {
    answer({
      osm: { body: { name: "", lat: "10.27701", lon: "123.94546", address: OSM_HIGHWAY } },
      landmark: { body: { name: "Babag Barangay Hall", lat: "10.2773457", lon: "123.9451645", address: OSM_HIGHWAY } },
    });
    // The cell is looked up from the highway, ~49 m from the hall.
    const onHighway = await placeFor(10.27701, 123.94546);
    expect(onHighway?.label).toBe("Manuel L. Quezon National Highway, Brgy. Babag, Lapu-Lapu City");
    await settle();

    // The child at the hall, same cell: the hall's name, no street.
    const atHall = await placeFor(10.27733, 123.94518);
    expect(atHall?.name).toBe("Babag Barangay Hall");
    expect(atHall?.label).toBe("Babag Barangay Hall, Brgy. Babag, Lapu-Lapu City");

    // Back on the highway: the street again, the hall as the nearby landmark.
    const back = await placeFor(10.27701, 123.94546);
    expect(back?.label).toBe("Manuel L. Quezon National Highway, Brgy. Babag, Lapu-Lapu City");
    expect(back?.landmark?.name).toBe("Babag Barangay Hall");
    expect(back?.landmark?.distanceMeters).toBeGreaterThan(AT_PLACE_M);

    // Saved for everyone, with the named places and the format version.
    const saved = mockRpc.mock.calls.find(([name]) => name === "save_location_place")?.[1] as { p_details: { spots: unknown[]; v: number } };
    expect(saved.p_details.v).toBe(2);
    expect(saved.p_details.spots).toHaveLength(1);
  });

  it("checks the exact point when the child is at a place the cell does not know yet", async () => {
    answer({ osm: { body: { name: "", lat: "10.2701", lon: "123.9401", address: OSM_HIGHWAY } }, landmark: { body: {} } });
    expect((await placeFor(10.2701, 123.9401))?.label).toBe("Manuel L. Quezon National Highway, Brgy. Babag, Lapu-Lapu City");
    await settle();

    // A store 45 m away, in the same cell, is found only from its own point.
    answer({ osm: { body: {} }, landmark: { body: { name: "Lim Sari-Sari Store", lat: "10.27035", lon: "123.94040" } } });
    checkSpot(10.27035, 123.9404);
    await settle();
    expect((await placeFor(10.27035, 123.9404))?.label).toBe("Lim Sari-Sari Store, Brgy. Babag, Lapu-Lapu City");
  });

  it("gives no address when neither source knows the spot", async () => {
    answer({ osm: { body: { address: {} } }, mapbox: { body: { features: [] } } });
    expect(await placeFor(10.2787, 123.9485)).toBeNull();
  });

  it("gives no address when the lookup cannot be reached", async () => {
    answer({ osm: { fail: true }, mapbox: { fail: true } });
    expect(await placeFor(10.2807, 123.9505)).toBeNull();
  });

  it("keeps OpenStreetMap's barangay and city over Mapbox's", () => {
    const place = withMapboxStreet(
      { label: "Brgy. Babag, Lapu-Lapu", barangay: "Brgy. Babag", city: "Lapu-Lapu" },
      { road: "Park Place Avenue", barangay: "Somewhere else", city: "Another city" },
    );
    expect(place?.label).toBe("Park Place Avenue, Brgy. Babag, Lapu-Lapu");
  });

  it("leaves the place alone when Mapbox has no street", () => {
    const place = { label: "Brgy. Babag, Lapu-Lapu", barangay: "Brgy. Babag", city: "Lapu-Lapu" };
    expect(withMapboxStreet(place, { barangay: "Babag" })).toBe(place);
    expect(withMapboxStreet(null, null)).toBeNull();
  });
});
