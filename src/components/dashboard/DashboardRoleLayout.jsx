/**
 * Shared role dashboard composition:
 * identity (via DashboardShell) → stats → grouped nav → workspace → optional aside.
 *
 * Role pages pass content slots and optional className hooks for premium modifiers.
 */
export default function DashboardRoleLayout({
  contentInnerClassName = "",
  dataSurfaceClassName = "",
  statsLampClassName = "",
  statsRegionClassName = "",
  mainGridClassName = "",
  stats = null,
  navigation = null,
  children,
  aside = null,
}) {
  const workspace = (
    <>
      {stats ? (
        <div className={statsLampClassName || undefined}>
          <div className={statsRegionClassName || undefined}>{stats}</div>
        </div>
      ) : null}
      <div className={mainGridClassName || undefined}>
        <section>
          {navigation}
          {children}
        </section>
        {aside}
      </div>
    </>
  );

  return (
    <div className={contentInnerClassName || undefined}>
      {dataSurfaceClassName ? <div className={dataSurfaceClassName}>{workspace}</div> : workspace}
    </div>
  );
}
