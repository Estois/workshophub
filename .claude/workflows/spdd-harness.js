// Reusable dynamic workflow that delivers a WorkshopHub story end-to-end.
// Parameterised on storyId — do not hard-code one ticket.

await phase('kickoff')
await agent(`Follow kickoff.md for ${storyId}`)

await phase('spdd')
await agent(`/spdd-analysis`)
await agent(`/spdd-reasons-canvas`)
await agent(`/spdd-generate`)

await phase('sensor')
await agent(`/sensor-and-fix`)

await phase('finish')
await agent(`/spdd-sync`)
await agent(`/finish-dev`)
