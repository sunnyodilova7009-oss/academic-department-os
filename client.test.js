import { beforeEach, expect, it, vi } from "vitest";
import { readAll } from "./client.js";
import { createClient } from "@supabase/supabase-js";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: vi.fn() })),
}));
const client = createClient.mock.results[0].value;
beforeEach(() => client.from.mockReset());
it("reads all pages beyond the Supabase default row limit", async () => {
  const range = vi
    .fn()
    .mockResolvedValueOnce({
      data: Array.from({ length: 1000 }, (_, id) => ({ id })),
    })
    .mockResolvedValueOnce({ data: [{ id: 1000 }] });
  client.from.mockReturnValue({ select: () => ({ order: () => ({ range }) }) });
  const rows = await readAll("attendance");
  expect(rows).toHaveLength(1001);
  expect(range.mock.calls).toEqual([
    [0, 999],
    [1000, 1999],
  ]);
});
it("propagates later-page permission errors instead of returning partial totals", async () => {
  const range = vi
    .fn()
    .mockResolvedValueOnce({
      data: Array.from({ length: 1000 }, (_, id) => ({ id })),
    })
    .mockResolvedValueOnce({
      data: null,
      error: { message: "permission denied" },
    });
  client.from.mockReturnValue({ select: () => ({ order: () => ({ range }) }) });
  await expect(readAll("attendance")).rejects.toThrow(
    "attendance: permission denied",
  );
});
