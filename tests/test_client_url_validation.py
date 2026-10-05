import pytest


@pytest.mark.asyncio
async def test_medical_document_link_must_be_https(client, auth_headers):
    owner = auth_headers("url-owner")
    bid = (await client.post("/crm/businesses", json={"name": "Urls", "city": "Львів"}, headers=owner)).json()["id"]
    cid = (await client.post("/crm/clients", json={"business_id": bid, "name": "Клієнт", "phone": "+380671234567"}, headers=owner)).json()["id"]

    for bad in ("javascript:alert(1)", "data:text/html,<script>1</script>", "http://insecure.example/x.pdf"):
        r = await client.patch(f"/crm/clients/{cid}", json={"medical_pdf_url": bad}, headers=owner)
        assert r.status_code == 422, (bad, r.status_code)
    r = await client.patch(f"/crm/clients/{cid}", json={"medical_pdf_url": "https://x.supabase.co/storage/v1/object/sign/documents/a.pdf"}, headers=owner)
    assert r.status_code == 200, r.text


@pytest.mark.asyncio
async def test_security_headers_on_api(client):
    r = await client.get("/businesses/ranking-rules")
    assert r.headers.get("x-content-type-options") == "nosniff"
    assert r.headers.get("x-frame-options") == "DENY"
