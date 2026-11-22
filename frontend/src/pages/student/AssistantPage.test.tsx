import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { StudentLayout } from "../../layouts/StudentLayout";
import AssistantPage from "./AssistantPage";

describe("assistant", () => {
  it("does not pretend to answer in the preview", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/library/assistant"]}>
        <Routes>
          <Route path="/library" element={<StudentLayout />}>
            <Route path="assistant" element={<AssistantPage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText("Question"), "Find Plato");
    await user.click(screen.getByRole("button", { name: "Ask" }));
    expect(screen.getByText("This preview does not run the assistant.")).toBeInTheDocument();
  });
});