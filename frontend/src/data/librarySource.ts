import type { LibrarySnapshot } from "../domain/types";
import { sampleLibrary } from "../mocks/sampleLibrary";

/** Preview catalogue. Signed-in screens read the database through CatalogueProvider. */
export function getLibrary(): LibrarySnapshot {
  return sampleLibrary;
}
