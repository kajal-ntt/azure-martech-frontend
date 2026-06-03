async function checkRoute(path) {
    console.log(`\nTesting: GET http://localhost:3000${path}`);
    try {
        const res = await fetch(`http://localhost:3000${path}`);
        console.log(`Status: ${res.status}`);
        const text = await res.text();
        console.log(`Body: ${text}`);
    } catch (e) {
        console.error("Fetch failed:", e);
    }
}

async function main() {
    await checkRoute("/api/campaigns/7576d7cb-a842-4708-89c8-555188129b8e/creatives");
    await checkRoute("/api/brands/6a4ecd6a-fdec-4e5a-819b-315d3f97ebe7/logo-url");
}

main();
