import { Outlet } from "react-router-dom";
import { Wordmark } from "../components/brand/Wordmark";

export function AuthLayout() {
  return (
    <div className="min-h-dvh bg-paper lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
      <section className="flex min-h-[22rem] flex-col justify-between bg-binding-deep px-6 py-8 text-paper sm:px-10 lg:min-h-dvh lg:px-14 lg:py-12">
        <Wordmark />
        <div className="max-w-xl py-14 lg:py-0">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-brass-soft">LibriMind</p>
          <h1 className="mt-4 max-w-lg font-serif text-4xl leading-[1.05] tracking-tight sm:text-6xl">
            The library, in order.
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-[#E7DCCB]">
            Physical shelves, digital reading, and a desk that can tell you what is actually available.
          </p>
        </div>
        <p className="text-sm text-[#C4B6A6]">Student and librarian interfaces share one collection.</p>
      </section>
      <section className="flex items-center px-6 py-12 sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <Outlet />
        </div>
      </section>
    </div>
  );
}
