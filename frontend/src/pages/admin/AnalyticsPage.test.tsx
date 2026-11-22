import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AdminLayout } from "../../layouts/AdminLayout";
import AnalyticsPage from "./AnalyticsPage";

describe("analytics desk", () => {
  it("counts the preview catalogue and does not invent assistant runs", async () => {
    render(
      <MemoryRouter initialEntries={["/admin/analytics"]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="analytics" element={<AnalyticsPage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "The desk in figures" })).toBeInTheDocument();
    expect(screen.getByText("Sign in to see whether the library API is answering.")).toBeInTheDocument();
    expect(screen.getByText("Questions are counted after you sign in.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Demand and the four-week forecast" })).toHaveAttribute("href", "/admin/insights");
  });
});