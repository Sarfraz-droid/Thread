import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { HttpError } from "./errors";
const ipv4Block = new BlockList(),
  ipv6Block = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
  ["192.0.0.0", 24],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  ipv4Block.addSubnet(address, prefix, "ipv4");
for (const [address, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
  ["::ffff:0:0", 96],
] as const)
  ipv6Block.addSubnet(address, prefix, "ipv6");
export function isPublicAddress(address: string) {
  const family = isIP(address);
  return (
    family !== 0 &&
    !(family === 4 ? ipv4Block : ipv6Block).check(
      address,
      family === 4 ? "ipv4" : "ipv6",
    )
  );
}
export async function assertPublicUrl(input: string) {
  const url = new URL(input);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443")
  )
    throw new HttpError(
      400,
      "Use a public HTTPS URL without credentials or a custom port.",
    );
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(hostname)
    ? [{ address: hostname }]
    : await lookup(hostname, { all: true });
  if (
    !addresses.length ||
    addresses.some(({ address }) => !isPublicAddress(address))
  )
    throw new HttpError(
      400,
      "Private, local, and metadata endpoints are not allowed.",
    );
  return url;
}
export async function publicFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  const target =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  await assertPublicUrl(target);
  // Refuse redirects; a configured remote server must use its final public endpoint.
  return fetch(input, {
    ...init,
    redirect: "error",
    signal: init?.signal ?? AbortSignal.timeout(20000),
  });
}
export async function providerJson<T>(
  url: string,
  init: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(45000),
  });
  if (!response.ok) {
    if (response.status === 429)
      throw new HttpError(
        429,
        "The provider quota or rate limit was reached. Wait or check your allowance.",
      );
    if (response.status === 402 || response.status === 432)
      throw new HttpError(
        503,
        "The provider allowance has run out. Check its billing settings.",
      );
    if (response.status === 401 || response.status === 403)
      throw new HttpError(
        503,
        "The provider rejected its API credentials. Check your environment settings.",
      );
    throw new HttpError(
      502,
      "The provider could not complete the request. Try again shortly.",
    );
  }
  return (await response.json()) as T;
}
