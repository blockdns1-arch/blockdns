import { expect } from "chai";
import fs from "fs";
import os from "os";
import path from "path";
import {
  mapRegistryLog,
  mapPricerLog,
  mapStakingLog,
  mapValidatorStakedLog,
  serializeEvent,
  appendEvent,
} from "../scripts/watch-events";

describe("Watch Events Mapping", function () {
  it("maps DomainRegistered to a DOMAIN_MINT payload", function () {
    const event = mapRegistryLog({
      owner: "0x0000000000000000000000000000000000000001",
      tokenId: 42n,
      name: "alice",
    });
    expect(event.type).to.equal("DOMAIN_MINT");
    expect(event.payload.name).to.equal("alice");
  });

  it("maps PremiumPaid to a REVENUE payload with burn/tresury split", function () {
    const event = mapPricerLog({
      payer: "0x0000000000000000000000000000000000000001",
      name: "ab",
      amount: 200n,
      burned: 100n,
      treasuryAmount: 100n,
    });
    expect(event.type).to.equal("REVENUE");
    expect(event.payload.amount).to.include("50% burned");
  });

  it("maps EmissionReleased to a STAKING_MILESTONE payload", function () {
    const event = mapStakingLog({ to: "0x0000000000000000000000000000000000000002", amount: 1234n, periodIndex: 2n });
    expect(event.type).to.equal("STAKING_MILESTONE");
    expect(event.payload.amount).to.include("period 2");
  });

  it("maps ValidatorStaked to a STAKING_MILESTONE payload", function () {
    const event = mapValidatorStakedLog({
      validator: "0x0000000000000000000000000000000000000003",
      amount: 5000n,
      totalStake: 10000n,
    });
    expect(event.type).to.equal("STAKING_MILESTONE");
    expect(event.payload.amount).to.include("validator staked");
  });

  it("serializes events as JSONL records for the social agent", function () {
    const line = serializeEvent({ type: "DOMAIN_MINT", payload: { name: "bob" } });
    const parsed = JSON.parse(line);
    expect(parsed.type).to.equal("DOMAIN_MINT");
    expect(parsed.payload.name).to.equal("bob");
  });

  it("appends JSONL lines and rotates oversized files", function () {
    const tmp = path.join(os.tmpdir(), `bdns-watch-test-${process.pid}.jsonl`);
    fs.rmSync(tmp, { force: true });
    fs.rmSync(`${tmp}.bak`, { force: true });

    appendEvent(serializeEvent({ type: "L2_STATS", payload: { stats: "x" } }), tmp);
    const lines = fs.readFileSync(tmp, "utf8").trim().split("\n");
    expect(lines).to.have.length(1);
    expect(JSON.parse(lines[0]).type).to.equal("L2_STATS");

    fs.writeFileSync(tmp, "x".repeat(2 * 1024 * 1024 + 1));
    appendEvent(serializeEvent({ type: "L2_STATS", payload: { stats: "y" } }), tmp);
    expect(fs.existsSync(`${tmp}.bak`)).to.equal(true);
    expect(fs.readFileSync(tmp, "utf8").trim().split("\n")).to.have.length(1);

    fs.rmSync(tmp, { force: true });
    fs.rmSync(`${tmp}.bak`, { force: true });
  });
});