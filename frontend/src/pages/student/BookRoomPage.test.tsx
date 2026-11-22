import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { StudentLayout } from "../../layouts/StudentLayout";
import BookRoomPage from "./BookRoomPage";

describe("book room", () => {
  it("uses the plain shelves and opens the selected record", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/library/shelf"]}>
        <Routes>
          <Route path="/library" element={<StudentLayout />}>
            <Route path="shelf" element={<BookRoomPage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "The book room" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Bookshelf" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /The Republic/ }));
    expect(screen.getByRole("heading", { name: "The Republic" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open the record" })).toHaveAttribute("href", "/library/books/republic");
    expect(screen.getByRole("link", { name: "Open the PDF" })).toHaveAttribute("href", "/library/digital/digital-republic");
  });
});