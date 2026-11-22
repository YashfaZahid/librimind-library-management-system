import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { LoadingState } from "./LoadingState";

describe("interface states", () => {
  it("exposes loading, empty, and error states", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <div>
        <LoadingState />
        <EmptyState title="Nothing here" detail="The shelf has no matching record." />
        <ErrorState title="The desk failed" detail="The loan could not be read." onRetry={onRetry} />
      </div>,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Loading the library");
    expect(screen.getByRole("heading", { name: "Nothing here" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("The loan could not be read.");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
