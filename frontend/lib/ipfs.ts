const IPFS_API = process.env.NEXT_PUBLIC_IPFS_API || "";
const PINATA_JWT = process.env.NEXT_PUBLIC_PINATA_JWT || "";

async function uploadToLocalNode(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${IPFS_API}/api/v0/add?cid-version=0`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(`IPFS node upload failed (${res.status})`);
  const json = await res.json();
  const cid = json?.Hash ?? json?.hash;
  if (!cid) throw new Error("IPFS node response missing CID");
  return cid as string;
}

async function uploadToPinataV3(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("https://uploads.pinata.cloud/v3/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${PINATA_JWT}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Pinata upload failed (${res.status})`);
  const json = await res.json();
  const cid = json?.data?.cid ?? json?.data?.ipfs_hash ?? json?.IpfsHash;
  if (!cid) throw new Error("Pinata response missing CID");
  return cid as string;
}

async function uploadToPinataV2(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${PINATA_JWT}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Pinata upload failed (${res.status})`);
  const json = await res.json();
  const cid = json?.IpfsHash;
  if (!cid) throw new Error("Pinata response missing CID");
  return cid as string;
}

export async function pinFileToIPFS(file: File): Promise<string> {
  if (PINATA_JWT) {
    try {
      return await uploadToPinataV3(file);
    } catch {
      return await uploadToPinataV2(file);
    }
  }

  if (!IPFS_API) {
    throw new Error("Configure NEXT_PUBLIC_PINATA_JWT or NEXT_PUBLIC_IPFS_API to upload files.");
  }

  return uploadToLocalNode(file);
}
