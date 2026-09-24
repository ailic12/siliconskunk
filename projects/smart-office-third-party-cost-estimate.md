# Smart Office — Third-Party Cost Estimate

Status: **Indicative cloud-architect estimate, 24 September 2026**.  
Basis: [approved HLD](../design/smart-office-hld.md), [approved context](../context/smart-office-context.md), [PoC selection](../poc/smart-office-poc-selection.md), and the [26-week delivery plan](smart-office-phases-and-milestones.md).  
Currency: **USD, before tax**, retail pay-as-you-go, **West Europe** Azure region, 730 hours per full month. These are third-party charges and are **separate from the 436 human person-days**. Azure is proposed by the HLD (N-01), still subject to client approval.

## Architecture-to-bill map

| HLD component | Costed service / assumption |
|---|---|
| Stateless API, check-in ingress, background worker | Azure Container Apps consumption plan; two always-on production API replicas and one small worker. Dev/test containers run mainly during working hours. This is a sizing assumption, not a selected implementation stack. |
| Single relational database | Azure Database for PostgreSQL Flexible Server. PoC/dev/test use small burstable servers; production uses a two-vCore general-purpose primary plus zone-redundant standby and 64 GiB provisioned storage per replica. Azure SQL remains an HLD alternative and needs a fresh quote if selected. |
| Internal managed queue | Azure Service Bus Standard, modest operation volume. |
| Responsive SPA | Static hosting allowance; exact Azure hosting SKU is not fixed in the HLD. |
| Build artifacts, secrets, logs, network | Basic Azure Container Registry, Key Vault transactions, Log Analytics/alerts, modest outbound bandwidth. |
| Entra ID and Microsoft Graph | Assumes the client's existing Microsoft 365/Entra licenses and eligible mailboxes/Teams accounts; no incremental user licenses are purchased for this project. Standard Graph operations and Teams APIs add no separate API meter under current Microsoft guidance. |

## Published rate checks and calculations

The [Azure Retail Prices API](https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices) was checked on 24 September 2026 for West Europe. Rates vary by region, agreement and date; rerun the [Azure pricing calculator](https://azure.microsoft.com/en-us/pricing/calculator/) before procurement. The published [PostgreSQL pricing page](https://azure.microsoft.com/en-gb/pricing/details/postgresql/flexible-server/) confirms that HA bills both replicas and backup storage up to the provisioned primary storage is included.

| Meter used | West Europe retail rate | Example calculation |
|---|---:|---|
| PostgreSQL Flexible Server B1ms burstable | $0.0199/hour | $14.53/month per continuously running dev/test database, before storage. |
| PostgreSQL Flexible Server general-purpose Dadsv5, 2 vCores | $0.212/hour | $154.76/month per server; **$309.52/month** for primary and standby. |
| PostgreSQL provisioned storage | $0.1369/GB-month | 64 GiB × two replicas ≈ **$17.52/month**. Production DB subtotal ≈ **$327/month** before excess backup/IOPS/network. |
| Container Apps active vCPU and memory | $0.000034/vCPU-second; $0.000004/GiB-second | Two 0.5-vCPU/1-GiB API replicas plus one 0.25-vCPU/0.5-GiB worker, all charged as active for 730 hours ≈ **$138/month** before the shared free grant. Actual idle billing may be lower; scale/load may be higher. |
| Service Bus Standard base | About $10/month | Standard includes an initial operations allowance; excess traffic is separately metered. |
| Container Registry Basic | $0.1666/day | About **$5/month** for one registry. |
| Log Analytics Analytics Logs ingestion | $2.99/GB beyond applicable free allowance | 10–20 GB/month ingested implies roughly **$15–$45/month** after the first 5 GB/month free allowance, plus alert/retention costs. |
| Key Vault standard operations | $0.03/10,000 operations | Usually below $1/month at the assumed volume, unless premium keys, certificates or HSM are selected. |

The [Container Apps pricing page](https://azure.microsoft.com/en-us/pricing/details/container-apps/) documents the shared monthly free grant and active/idle behavior. [Service Bus](https://azure.microsoft.com/en-us/pricing/details/service-bus/), [Container Registry](https://azure.microsoft.com/en-us/pricing/details/container-registry/), [Azure Monitor](https://azure.microsoft.com/en-us/pricing/details/monitor/), and [Key Vault](https://azure.microsoft.com/en-us/pricing/details/key-vault/) describe their billing meters. The exact numerical rates above come from the Retail Prices API's West Europe USD meters; the rounded service totals are this document's calculations, not Microsoft quotes.

## Cost envelope

| Period | Estimated external run cost | Basis |
|---|---:|---|
| PoC and development before production | **$60–$150/month** | Small dev/test databases, intermittent containers, shared queue/registry, low log volume. PoC mocks Entra, Graph and physical providers, as approved in the selection. |
| Production after go-live, including dev/test | **$550–$900/month** | About $327 production HA DB, $100–$250 app/worker compute and scaling, $10 queue, $5 registry, $20–$75 logs/alerts, $10–$30 static hosting, $0–$50 secrets/storage/egress, plus $60–$150 dev/test. This is a sizing envelope, not a contractual price. |
| First 26 weeks of the project | **$1,000–$3,000** infrastructure allowance | Dev/test for six months plus production-like infrastructure for roughly the final 1–2 months. Earlier creation of production, sustained load testing, or higher logs can move the spend upward. |
| First 12 months after go-live | **$6,600–$10,800** | Twelve months at the steady-state $550–$900/month envelope, before workload growth or discounts. |

The low end assumes the existing tenant, ordinary network access and moderate traffic. The at-least-5,000-user requirement is a **capacity floor**, not a transaction forecast: HLD Q-01 has no peak traffic number. The two small API replicas and two-vCore database are therefore **provisional** and must pass the HLD's real-load test before budget approval. The HLD's proposed RTO/RPO values are discussion baselines, not confirmed commitments; tighter targets could require more infrastructure. Zone-redundant PostgreSQL HA alone roughly doubles database compute and storage compared with one instance.

## Costs that cannot yet be responsibly totaled

| Item | Decision or quote needed |
|---|---|
| Agentic SDLC tooling | C-07 requires approved AI tools/accounts, but neither the HLD nor context names a vendor, model, seat count or token volume. Obtain the chosen provider's seat/API quote. Do not treat agent use as free; it is excluded from the $1,000–$3,000 infrastructure allowance. |
| Microsoft 365 / Entra licenses | Existing corporate subscriptions are assumed. Confirm that every employee and sending identity has the necessary license and permissions. Incremental licenses, if needed, are outside this estimate. [Microsoft Graph guidance](https://learn.microsoft.com/en-us/graph/metered-api-overview) says most standard APIs are included with user subscriptions; [the current metered list](https://learn.microsoft.com/en-us/graph/metered-api-list) says Teams APIs are no longer metered. |
| Real check-in provider | Q-04 is open; badge readers, access-control gateways, sensor subscriptions, installation and vendor certification are excluded. PoC uses two simulated software adapters. |
| Corporate security/networking | An enterprise landing zone, private endpoints, WAF/Front Door, dedicated support plan, SIEM export and cross-region disaster recovery are not mandated or sized by the HLD. Price them when N-01 and Q-08/Q-09 are settled. |
| Procurement and commercial terms | Azure enterprise discounts, VAT, foreign exchange, reserved capacity and data-residency choices are not reflected in retail USD figures. |

**Budget gate:** confirm cloud region/service choice (N-01), expected peak load (Q-01), retention (Q-07), availability/recovery targets (Q-08/Q-09), check-in provider (Q-04), notification channel (Q-06), and approved AI tooling before treating this as a procurement estimate. Recalculate from the actual deployed SKUs after the W10 PoC and again after W24 load/recovery tests.
