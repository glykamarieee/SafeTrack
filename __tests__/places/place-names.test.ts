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

import { placeFor, withMapboxStreet } from "../../lib/places";

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
    expect(place?.label).toBe("University of Cebu - Lapu-Lapu Mandaue Campus, A.C. Cortes Avenue, Brgy. Looc, Mandaue, Central Visayas");
    expect(place?.mapbox).toBeUndefined();
    await settle();
    expect(calls.mapbox).toBe(0);
    expect(mockRpc).toHaveBeenCalledWith("save_location_place", expect.anything());
  });

  it("adds Mapbox's street where OpenStreetMap has none, and does not save it", async () => {
    const calls = answer({ osm: { body: OSM_NO_STREET }, mapbox: { body: MAPBOX_STREET } });
    const place = await placeFor(10.2727, 123.9425);
    expect(place?.label).toBe("Park Place Avenue, Brgy. Babag, Lapu-Lapu, Central Visayas");
    expect(place?.mapbox).toBe(true);
    await settle();
    expect(calls.mapbox).toBe(1);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("shows what OpenStreetMap gave when Mapbox fails", async () => {
    answer({ osm: { body: OSM_NO_STREET }, mapbox: { fail: true } });
    const place = await placeFor(10.2747, 123.9445);
    expect(place?.label).toBe("Brgy. Babag, Lapu-Lapu, Central Visayas");
    expect(place?.mapbox).toBeUndefined();
  });

  it("shows what OpenStreetMap gave when Mapbox answers with an error", async () => {
    answer({ osm: { body: OSM_NO_STREET }, mapbox: { ok: false, body: {} } });
    const place = await placeFor(10.2767, 123.9465);
    expect(place?.label).toBe("Brgy. Babag, Lapu-Lapu, Central Visayas");
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
