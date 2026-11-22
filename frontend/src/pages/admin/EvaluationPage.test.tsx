import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AdminLayout } from "../../layouts/AdminLayout";
import EvaluationPage from "./EvaluationPage";

describe("evaluation", () => {
  it("does not show scores until a study has been run", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/admin/evaluation"]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="evaluation" element={<EvaluationPage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Three ways of answering" })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Run the study" }));
    expect(screen.getByText("Sign in and run this from the API. This preview does not invent scores.")).toBeInTheDocument();
  });
});