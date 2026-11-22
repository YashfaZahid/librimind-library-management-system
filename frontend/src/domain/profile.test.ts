import { describe, expect, it } from "vitest";
import { profileWrite } from "./profile";

describe("profile writes", () => {
  it("keeps the role out of the saved fields", () => {
    const written = profileWrite({
      fullName: "  Amina Rahman ",
      programme: " Design ",
      interests: "Literature, Literature, Design",
    });
    expect(written).toEqual({
      full_name: "Amina Rahman",
      programme: "Design",
      reading_interests: ["Literature", "Design"],
    });
    expect(written).not.toHaveProperty("role");
  });
});
