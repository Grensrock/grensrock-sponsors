import GrensrockApp from "@/components/app/GrensrockApp";

/* app/auth/callback sends a failed sign-in back here as ?auth_error=<code>.
   Reading it on the server and handing it down, rather than reaching for the
   URL once the page is already up, is what lets the landing page render the
   explanation in the FIRST paint — a sponsor whose link expired sees why
   immediately, instead of a plain sign-in form that flickers into an error. */
export default async function Home(props: PageProps<"/">) {
  const { auth_error } = await props.searchParams;
  return <GrensrockApp authError={typeof auth_error === "string" ? auth_error : ""} />;
}
