import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { StudentLayout } from "../../layouts/StudentLayout";
import DiscoverPage from "./DiscoverPage";

describe("discover", () => {
  it("shows a permitted result and a result that cannot be saved", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/library/discover"]}>
        <Routes>
          <Route path="/library" element={<StudentLayout />}>
            <Route path="discover" element={<DiscoverPage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText("Search"), "plato");
    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(screen.getByRole("button", { name: "Save to my shelf" })).toBeInTheDocument();
    expect(screen.getByText("This record is not available for download.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save to my shelf" }));
    expect(screen.getByText("This preview does not save files.")).toBeInTheDocument();
  });
});