import { useRouter } from "next/router";

function toLabel(segment) {
  if (segment === "listings") return "Districts";
  if (segment === "dashboard") return "Dashboard";
  if (segment === "agent") return "Operator";
  if (segment === "admin") return "Admin";
  if (segment === "favorites") return "Favorites";
  if (segment === "listing") return "Listing";
  return segment.replace(/-/g, " ");
}

export default function Breadcrumbs() {
  const router = useRouter();
  const path = router.asPath.split("?")[0];
  const segments = path.split("/").filter(Boolean);
  let builtPath = "";

  return (
    <div className="breadcrumbs" aria-label="Breadcrumb">
      <button type="button" className="breadcrumbItem" onClick={() => router.push("/")}>
        Home
      </button>

      {segments.map((segment, index) => {
        builtPath += `/${segment}`;
        const label = toLabel(segment);

        return (
          <span key={`${segment}-${index}`}>
            {" > "}
            <button
              type="button"
              className="breadcrumbItem"
              onClick={() => router.push(builtPath)}
            >
              {label}
            </button>
          </span>
        );
      })}
    </div>
  );
}
