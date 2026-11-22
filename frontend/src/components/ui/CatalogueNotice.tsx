import { ErrorState } from "./ErrorState";
import { LoadingState } from "./LoadingState";
import { useCatalogue } from "../../data/catalogue";

export function CatalogueNotice() {
  const catalogue = useCatalogue();
  if (catalogue.status === "error") {
    return (
      <ErrorState
        title="The catalogue did not load"
        detail={catalogue.error ?? "The library could not be read."}
        onRetry={() => void catalogue.reload()}
      />
    );
  }
  return <LoadingState />;
}
