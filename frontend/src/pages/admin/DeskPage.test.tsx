import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { deskSentence, deskSummary } from "../../domain/library";
import { AdminLayout } from "../../layouts/AdminLayout";
import { sampleLibrary } from "../../mocks/sampleLibrary";
import DeskPage from "./DeskPage";

describe("desk", () => {
  it("prints the summary calculated from the sample loans", () => {
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<DeskPage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("note")).toHaveTextContent("Sample library");
    expect(screen.getByText(deskSentence(deskSummary(sampleLibrary)))).toBeInTheDocument();
    expect(screen.getByText("Bilal Hussain", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("Overdue")).toBeInTheDocument();
  });
});
