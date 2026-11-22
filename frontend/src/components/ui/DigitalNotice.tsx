import { ErrorState } from "./ErrorState";
import { LoadingState } from "./LoadingState";
import { useDigital } from "../../data/digital";

export function DigitalNotice() {
  const digital = useDigital();
  if (digital.status === "error") {
    return (
      <ErrorState
        title="The digital library did not load"
        detail={digital.error ?? "The files could not be read."}
        onRetry={() => void digital.reload()}
      />
    );
  }
  return <LoadingState label="Loading the digital library" />;
}
