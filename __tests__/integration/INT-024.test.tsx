/**
 * Integration testing: Dashboard Management -> Notification Delivery (live backend).
 * The real Notifications screen is opened for UT Child One, signed in as the test guardian,
 * and must list the child's stored safety updates (the same events that are pushed).
 */
import { render, screen, waitFor } from "@testing-library/react-native";
import NotificationsScreen from "../../app/(app)/notifications";
import { selectChild } from "../../hooks/useSelectedChild";
import { supabase } from "../../lib/supabase";
import { recordActual } from "../setup/record";
import { signInAs, signOutLocally } from "../setup/session";
import { accounts } from "../setup/accounts";
import { useAuthStore } from "../../store/authStore";
import { MODULE } from "./helpers";

const A = accounts as any;
afterAll(signOutLocally);

describe("Received safety alerts on the Notifications screen", () => {
  test("INT-024: The Notifications screen lists the child's safety updates", async () => {
    await signInAs(A.guardianWithChild);
    const child = useAuthStore.getState().linkedChildren.find((c) => c.fullName === "UT Child One")!;
    const { data } = await supabase.from("geofence_events").select("title, occurred_at").eq("child_id", child.id).order("occurred_at", { ascending: false }).limit(3);
    expect((data ?? []).length).toBeGreaterThan(0);
    selectChild(child.id);
    await render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getAllByText(data![0].title).length).toBeGreaterThan(0), { timeout: 20000 });
    recordActual(MODULE, "INT-024", `The Notifications screen for UT Child One listed the latest stored safety update "${data![0].title}" (${data![0].occurred_at}).`);
  });
});
