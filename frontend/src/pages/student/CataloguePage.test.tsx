import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { StudentLayout } from "../../layouts/StudentLayout";
import CataloguePage from "./CataloguePage";

function renderCatalogue() {
  render(
    <MemoryRouter initialEntries={["/library/catalogue"]}>
      <Routes>
        <Route path="/library" element={<StudentLayout />}>
          <Route path="catalogue" element={<CataloguePage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("catalogue", () => {
  it("labels the preview and filters the sample records", async () => {
    const user = userEvent.setup();
    renderCatalogue();
    expect(screen.getByRole("note")).toHaveTextContent("Sample library");
    expect(screen.getByRole("link", { name: /The Republic/ })).toBeInTheDocument();

    await user.type(screen.getByLabelText("Search"), "plato");
    expect(screen.getByRole("link", { name: /The Republic/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Sapiens/ })).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText("Search"));
    await user.type(screen.getByLabelText("Search"), "zzzz-no-such-book");
    expect(screen.getByRole("heading", { name: "Nothing matches" })).toBeInTheDocument();
  });
});
