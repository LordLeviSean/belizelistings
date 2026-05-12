import { useCallback, useState } from "react";
import { Share2 } from "lucide-react";
import favoriteStyles from "../styles/FavoriteButton.module.css";
import { shareListingLink } from "../utils/shareListing";

export default function ShareListingIconButton({
  listingId,
  title,
  surface = "default",
  className = "",
}) {
  const [copied, setCopied] = useState(false);

  const onClick = useCallback(
    async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const result = await shareListingLink({ id: listingId, title });
      if (result.ok && result.method === "clipboard") {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      }
    },
    [listingId, title]
  );

  return (
    <button
      type="button"
      className={[
        favoriteStyles.shareIconButton,
        copied ? favoriteStyles.shareIconButtonCopied : "",
        surface === "saved" ? favoriteStyles.shareIconButtonWarm : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={copied ? "Listing link copied" : "Share listing"}
      onClick={onClick}
    >
      <Share2 aria-hidden="true" />
    </button>
  );
}
