### DefiLlama Pro API Key

Your key is saved locally in your browser's storage.

Your API key will be injected into requests to **`https://pro-api.llama.fi`** endpoints.

When your API key is set, free endpoints will be changed to pro version to bypass rate limits"

Open Menu

Open Search Search Keyboard Shortcut: `CTRL⌃ k`

- [Using AI?](https://api-docs.defillama.com/#description/using-ai)

- [SDK](https://api-docs.defillama.com/#description/sdk)

- Collapse TVL


[TVL](https://api-docs.defillama.com/#tag/tvl)

  - [List all protocols on defillama along with their tvl\\
    \\
    HTTP Method:  GET](https://api-docs.defillama.com/#tag/tvl/get/protocols)

  - [Get historical TVL of a protocol and breakdowns by token and chain\\
    \\
    HTTP Method:  GET](https://api-docs.defillama.com/#tag/tvl/get/protocol/{protocol})

  - [Get historical TVL (excludes liquid staking and double counted tvl) of DeFi on all chains\\
    \\
    HTTP Method:  GET](https://api-docs.defillama.com/#tag/tvl/get/v2/historicalChainTvl)

  - [Get historical TVL (excludes liquid staking and double counted tvl) of a chain\\
    \\
    HTTP Method:  GET](https://api-docs.defillama.com/#tag/tvl/get/v2/historicalChainTvl/{chain})

  - [Simplified endpoint to get current TVL of a protocol\\
    \\
    HTTP Method:  GET](https://api-docs.defillama.com/#tag/tvl/get/tvl/{protocol})

  - [Get current TVL of all chains\\
    \\
    HTTP Method:  GET](https://api-docs.defillama.com/#tag/tvl/get/v2/chains)

  - [Lists the amount of a certain token within all protocols. Data for the Token Usage page\\
    \\
    HTTP Method:  GET](https://api-docs.defillama.com/#tag/tvl/get/api/tokenProtocols/{symbol})

  - [Lists the amount of inflows and outflows for a protocol at a given date\\
    \\
    HTTP Method:  GET](https://api-docs.defillama.com/#tag/tvl/get/api/inflows/{protocol}/{timestamp})

  - [Get assets of all chains\\
    \\
    HTTP Method:  GET](https://api-docs.defillama.com/#tag/tvl/get/api/chainAssets)

  - [Get aggregate TVL metrics for a protocol\\
    \\
    HTTP Method:  GET\\
    \\
     Beta](https://api-docs.defillama.com/#tag/tvl/get/api/v2/metrics/tvl/protocol/{protocol})

  - [Get historical TVL chart for a protocol\\
    \\
    HTTP Method:  GET\\
    \\
     Beta](https://api-docs.defillama.com/#tag/tvl/get/api/v2/chart/tvl/protocol/{protocol})

  - [Get historical TVL chart for a protocol broken down by chain\\
    \\
    HTTP Method:  GET\\
    \\
     Beta](https://api-docs.defillama.com/#tag/tvl/get/api/v2/chart/tvl/protocol/{protocol}/chain-breakdown)

  - [Get historical TVL chart for a protocol broken down by token\\
    \\
    HTTP Method:  GET\\
    \\
     Beta](https://api-docs.defillama.com/#tag/tvl/get/api/v2/chart/tvl/protocol/{protocol}/token-breakdown)
- Expand coins


[coins](https://api-docs.defillama.com/#tag/coins)

- Expand stablecoins


[stablecoins](https://api-docs.defillama.com/#tag/stablecoins)

- Expand yields


[yields](https://api-docs.defillama.com/#tag/yields)

- Expand volumes


[volumes](https://api-docs.defillama.com/#tag/volumes)

- Expand fees and revenue


[fees and revenue](https://api-docs.defillama.com/#tag/fees-and-revenue)

- Expand perps


[perps](https://api-docs.defillama.com/#tag/perps)

- Expand Unlocks


[Unlocks](https://api-docs.defillama.com/#tag/unlocks)

- Expand main page


[main page](https://api-docs.defillama.com/#tag/main-page)

- Expand token liquidity


[token liquidity](https://api-docs.defillama.com/#tag/token-liquidity)

- Expand Treasury


[Treasury](https://api-docs.defillama.com/#tag/treasury)

- Expand Oracles


[Oracles](https://api-docs.defillama.com/#tag/oracles)

- Expand Forks


[Forks](https://api-docs.defillama.com/#tag/forks)

- Expand Dimensions


[Dimensions](https://api-docs.defillama.com/#tag/dimensions)

- Expand Financial Statements


[Financial Statements](https://api-docs.defillama.com/#tag/financial-statements)

- Expand ETFs


[ETFs](https://api-docs.defillama.com/#tag/etfs)

- Expand narratives


[narratives](https://api-docs.defillama.com/#tag/narratives)

- Expand bridges


[bridges](https://api-docs.defillama.com/#tag/bridges)

- Expand meta


[meta](https://api-docs.defillama.com/#tag/meta)

- Expand DAT


[DAT](https://api-docs.defillama.com/#tag/dat)

- Expand Equities


[Equities](https://api-docs.defillama.com/#tag/equities)

- Expand RWA


[RWA](https://api-docs.defillama.com/#tag/rwa)


[Open API Client](https://client.scalar.com/?url=https%3A%2F%2Fapi-docs.defillama.com%2F&integration=vue&utm_source=api-reference&utm_medium=button&utm_campaign=sidebar)

[Powered by Scalar](https://www.scalar.com/)

v1.0.0-oas3

OAS 3.1.1

# DefiLlama API

Download OpenAPI Document
json
Download OpenAPI Document
yaml

## Using AI?

DefiLlama offers two ways to use our data with AI:

| Resource | For | Description |
| --- | --- | --- |
| [**llms.txt**](https://api-docs.defillama.com/llms.txt) | AI assistants (ChatGPT, Claude, Cursor, etc.) | Paste this link into your AI assistant for LLM-optimized docs |
| [**MCP Server**](https://defillama.com/mcp) | AI agents | Connect your agent directly to DefiLlama data — 23 tools, requires an API plan |

**Quick start (MCP)** — paste this into your AI agent:

```c
Read https://raw.githubusercontent.com/DefiLlama/defillama-skills/refs/heads/master/defillama-setup/SKILL.md and follow the instructions to connect to DefiLlama MCP
```

* * *

Need higher rate limits or priority support? We offer a premium plan for 300$/mo. To get it, go to [https://defillama.com/subscription](https://defillama.com/subscription)

## SDK

**JavaScript** — `npm install @defillama/api` — [GitHub](https://github.com/DefiLlama/api-sdk)

**Python** — `pip install defillama-sdk` — [GitHub](https://github.com/DefiLlama/python-sdk)

Quick start (JavaScript):

```ts
import { DefiLlama } from '@defillama/api'

const client = new DefiLlama()
const protocols = await client.tvl.getProtocols()
```

Quick start (Python):

```py
from defillama_sdk import DefiLlama

client = DefiLlama()
protocols = client.tvl.getProtocols()
```

Server

Server:https://api.llama.fi

Client Libraries

Shell

Ruby

Node.js

PHP

PythonLibcurlHttpClientRestSharpclj-httpHttpNewRequestHTTP/1.1AsyncHttpjava.net.httpOkHttpUnirestFetchAxiosofetchjQueryXHROkHttpFetchAxiosofetchundiciNSURLSessionCohttpcURLGuzzleInvoke-WebRequestInvoke-RestMethodhttp.clientRequestsHTTPX (Sync)HTTPX (Async)httrnet::httpreqwestCurlWgetHTTPieNSURLSession

More Select from all clients

Curl Shell

## TVL

​#Copy link

Retrieve TVL data

TVL Operations

- [get/protocols](https://api-docs.defillama.com/#tag/tvl/get/protocols)
- [get/protocol/{protocol}](https://api-docs.defillama.com/#tag/tvl/get/protocol/{protocol})
- [get/v2/historicalChainTvl](https://api-docs.defillama.com/#tag/tvl/get/v2/historicalChainTvl)
- [get/v2/historicalChainTvl/{chain}](https://api-docs.defillama.com/#tag/tvl/get/v2/historicalChainTvl/{chain})
- [get/tvl/{protocol}](https://api-docs.defillama.com/#tag/tvl/get/tvl/{protocol})
- [get/v2/chains](https://api-docs.defillama.com/#tag/tvl/get/v2/chains)
- [get/api/tokenProtocols/{symbol}  API Plan](https://api-docs.defillama.com/#tag/tvl/get/api/tokenProtocols/{symbol})
- [get/api/inflows/{protocol}/{timestamp}  API Plan](https://api-docs.defillama.com/#tag/tvl/get/api/inflows/{protocol}/{timestamp})
- [get/api/chainAssets  API Plan](https://api-docs.defillama.com/#tag/tvl/get/api/chainAssets)
- [get/api/v2/metrics/tvl/protocol/{protocol}  API Plan  Beta](https://api-docs.defillama.com/#tag/tvl/get/api/v2/metrics/tvl/protocol/{protocol})
- [get/api/v2/chart/tvl/protocol/{protocol}  API Plan  Beta](https://api-docs.defillama.com/#tag/tvl/get/api/v2/chart/tvl/protocol/{protocol})
- [get/api/v2/chart/tvl/protocol/{protocol}/chain-breakdown  API Plan  Beta](https://api-docs.defillama.com/#tag/tvl/get/api/v2/chart/tvl/protocol/{protocol}/chain-breakdown)
- [get/api/v2/chart/tvl/protocol/{protocol}/token-breakdown  API Plan  Beta](https://api-docs.defillama.com/#tag/tvl/get/api/v2/chart/tvl/protocol/{protocol}/token-breakdown)

### List all protocols on defillama along with their tvl

​#Copy link

Responses

- 200


Array of all protocols with their TVL data





application/json


Request Example for get/protocols

JavaScript SDK

Copy content

```javascript
const result = await client.tvl.getProtocols()
```

Test Request(get /protocols)

Status: 200

Show Schema

Copy content

```json
[\
  {\
    "id": "2269",\
    "name": "Aave",\
    "symbol": "AAVE",\
    "category": "Lending",\
    "chains": [\
      "Ethereum",\
      "Polygon"\
    ],\
    "tvl": 5200000000,\
    "chainTvls": {\
      "Ethereum": 3200000000,\
      "Polygon": 2000000000\
    },\
    "change_1d": 2.1,\
    "change_7d": -5.3\
  }\
]
```

Array of all protocols with their TVL data

### Get historical TVL of a protocol and breakdowns by token and chain

​#Copy link

Path Parameters

- protocol

Type: string

required



Example

aave











protocol slug


Responses

- 200


Protocol details with historical TVL data and chain breakdowns





application/json

- 404









Protocol not found


Request Example for get/protocol/ _{protocol}_

JavaScript SDK

Copy content

```javascript
const result = await client.tvl.getProtocol('<protocol>')
```

Test Request(get /protocol/{protocol})

Status: 200Status: 404

Show Schema

Copy content

```json
{
  "id": "parent#aave",
  "name": "AAVE",
  "symbol": "AAVE",
  "category": "Lending",
  "chains": [\
    "Ethereum",\
    "Polygon",\
    "Avalanche"\
  ],
  "currentChainTvls": {
    "Ethereum": 3200000000,
    "Polygon": 1500000000
  },
  "chainTvls": {
    "propertyName*": {
      "tvl": [\
        {\
          "date": 1609459200,\
          "totalLiquidityUSD": 1000000\
        }\
      ],
      "tokens": [\
        {\
          "date": 1609459200,\
          "tokens": {\
            "USDC": 1000000,\
            "USDT": 800000\
          }\
        }\
      ]
    }
  }
}
```

Protocol details with historical TVL data and chain breakdowns

### Get historical TVL (excludes liquid staking and double counted tvl) of DeFi on all chains

​#Copy link

Responses

- 200


Historical TVL data for all chains combined





application/json


Request Example for get/v2/historicalChainTvl

JavaScript SDK

Copy content

```javascript
const result = await client.tvl.getHistoricalChainTvl()
```

Test Request(get /v2/historicalChainTvl)

Status: 200

Show Schema

Copy content

```json
[\
  {\
    "date": 1609459200,\
    "tvl": 15000000000\
  }\
]
```

Historical TVL data for all chains combined

### Get historical TVL (excludes liquid staking and double counted tvl) of a chain

​#Copy link

Path Parameters

- chain

Type: string

required



Example

Ethereum











chain slug, you can get these from /chains or the chains property on /protocols


Responses

- 200


Historical TVL data for the specified chain





application/json

- 404









Chain not found


Request Example for get/v2/historicalChainTvl/ _{chain}_

JavaScript SDK

Copy content

```javascript
const result = await client.tvl.getHistoricalChainTvl('<chain>')
```

Test Request(get /v2/historicalChainTvl/{chain})

Status: 200Status: 404

Show Schema

Copy content

```json
[\
  {\
    "date": 1609459200,\
    "tvl": 45000000000\
  }\
]
```

Historical TVL data for the specified chain

### Simplified endpoint to get current TVL of a protocol

​#Copy link

Simplified endpoint that only returns a number, the current TVL of a protocol

Path Parameters

- protocol

Type: string

required



Example

uniswap











protocol slug


Responses

- 200


Current TVL of the protocol in USD





application/json

- 404









Protocol not found


Request Example for get/tvl/ _{protocol}_

JavaScript SDK

Copy content

```javascript
const result = await client.tvl.getTvl('<protocol>')
```

Test Request(get /tvl/{protocol})

Status: 200Status: 404

Show Schema

Copy content

```json
4962012809.795062
```

Current TVL of the protocol in USD

### Get current TVL of all chains

​#Copy link

Responses

- 200


Array of all chains with their TVL data





application/json


Request Example for get/v2/chains

JavaScript SDK

Copy content

```javascript
const result = await client.tvl.getChains()
```

Test Request(get /v2/chains)

Status: 200

Show Schema

Copy content

```json
[\
  {\
    "gecko_id": "ethereum",\
    "tvl": 65998652431.40251,\
    "tokenSymbol": "ETH",\
    "cmcId": "1027",\
    "name": "Ethereum",\
    "chainId": 1\
  }\
]
```

Array of all chains with their TVL data

API Plan

### Lists the amount of a certain token within all protocols. Data for the Token Usage page

​#Copy link

Path Parameters

- symbol

Type: string

required



Example

usdt











token slug


Responses

- 200


successful operation





application/json


Request Example for get/api/tokenProtocols/ _{symbol}_

JavaScript SDK

Copy content

```javascript
const result = await proClient.tvl.getTokenProtocols('<symbol>')
```

Test Request(get /api/tokenProtocols/{symbol})

Status: 200

Show Schema

Copy content

```json
[\
  {\
    "name": "Portal",\
    "category": "Bridge",\
    "amountUsd": {\
      "coingecko:tether-avalanche-bridged-usdt-e": 6485.2310529788765,\
      "coingecko:xcusdt": 45.514624238131,\
      "coingecko:layerzero-bridged-usdt-aptos": 7312.740629193999\
    }\
  }\
]
```

successful operation

API Plan

### Lists the amount of inflows and outflows for a protocol at a given date

​#Copy link

Path Parameters

- protocol

Type: string

required



Example

compound-v3











protocol slug

- timestamp

Type: integer

required



Example

1767139200











unix timestamp


Responses

- 200


successful operation





application/json


Request Example for get/api/inflows/ _{protocol}_/ _{timestamp}_

JavaScript SDK

Copy content

```javascript
const result = await proClient.tvl.getInflows('<protocol>', 1704067200, 1704153600)
```

Test Request(get /api/inflows/{protocol}/{timestamp})

Status: 200

Show Schema

Copy content

```json
{
  "outflows": -160563462.23474675,
  "oldTokens": {
    "date": 1700005031,
    "tvl": {
      "POLYGONUSDC": 2800590.050521,
      "STMATIC": 5910852.971103674,
      "USDC.E": 213182.234023,
      "WETH": 138751.92261049704,
      "WSTETH": 21205.858768287606,
      "COMP": 899912.2484411557,
      "ARB": 5191395.55706979,
      "UNI": 3276947.8126982865,
      "WBTC": 15237.12702489,
      "WMATIC": 4316699.376111328,
      "USDBC": 1567657.999816,
      "GMX": 44027.42587184711,
      "CBETH": 10011.824096757742,
      "LINK": 2915041.329272804,
      "USDC": 27302168.767972,
      "MATICX": 5999572.681088426
    }
  },
  "currentTokens": {
    "date": 1752771743,
    "tvl": {
      "SKY": 1839111.3665808514,
      "WSUPEROETHB": 610.1258731272615,
      "RETH": 335.9162918778323,
      "WEETH": 21264.320107593303,
      "STMATIC": 43248.612454883136,
      "TETH": 7537.467077317422,
      "USDT": 23936602.852221,
      "USDC.E": 457484.93217,
      "USDS": 986286.7461886762,
      "FBTC": 7.88084468,
      "WUSDM": 9912.583708525639,
      "COMP": 199962.19982196926,
      "UNI": 748399.6623864435,
      "WRON": 48676.91287257022,
      "WBTC": 8346.44481716,
      "EZETH": 9378.908917279387,
      "SDEUSD": 4476349.521512799,
      "OSETH": 1751.011747340086,
      "USDT0": 4807642.14842,
      "LINK": 629790.4518594383,
      "DEUSD": 14779291.40757071,
      "MATICX": 239292.60540364735,
      "ETHX": 7.643953648e-9,
      "POLYGONUSDC": 1130561.097829,
      "OP": 474055.27558234957,
      "RSWETH": 0.7588296185577288,
      "SFRAX": 32550977.989188965,
      "METH": 1256.0286269578846,
      "WETH": 106772.79955793211,
      "WSTETH": 127030.77547884149,
      "ARB": 8082828.497277849,
      "RSETH": 13198.88264941232,
      "WMATIC": 1192273.6401273129,
      "GMX": 6408.6736121308695,
      "USDBC": 200217.562935,
      "CBETH": 2094.7317932368333,
      "USDE": 1660443.2086449957,
      "ETH": 657.5898609775202,
      "SUSDS": 2360827.122683512,
      "USDC": 67152880.13345899,
      "TBTC": 297.109236856541,
      "AXS": 156.95240126041227,
      "CBBTC": 722.70428829,
      "WRSETH": 208.78735872239974,
      "AERO": 3582072.5610455093
    }
  }
}
```

successful operation

API Plan

### Get assets of all chains

​#Copy link

Responses

- 200


successful operation





application/json


Request Example for get/api/chainAssets

JavaScript SDK

Copy content

```javascript
const result = await proClient.tvl.getChainAssets()
```

Test Request(get /api/chainAssets)

Status: 200

Show Schema

Copy content

```json
{
  "chain": {
    "canonical": {
      "total": "4482065428.82707789718257509123",
      "breakdown": {
        "AGLD": "8.25709",
        "STPT": "263726.9847408758",
        "APU": "43899.14483171882",
        "CTX": "595333.6768847435",
        "APW": "37727.892544515686"
      }
    },
    "native": {
      "total": "10848868127.0093572327157505031494340578574406321858",
      "breakdown": {
        "BENI": "1322294.3731837485",
        "ANIME": "10.7583162713828217314035397949084",
        "SACA": "114132.47631920826",
        "HOKK": "4966.3804669563400723148947324498025",
        "TOSHI": "91927630.6839119443580116994151258714"
      }
    },
    "thirdParty": {
      "total": "3182802062.49398527398560408906",
      "breakdown": {
        "BRZ": "1810685.01887618296911",
        "BOBA": "0",
        "BURN": "0",
        "GGTK": "0.6545695",
        "GYFI": "2618437.7978"
      }
    },
    "total": {
      "total": "18513735618.330420403",
      "breakdown": {
        "AGLD": "8.25709",
        "STPT": "263726.9847408758",
        "APU": "43899.14483171882",
        "CTX": "595333.6768847435",
        "APW": "37727.892544515686"
      }
    }
  },
  "timestamp": 1752843956
}
```

successful operation

API Plan

Beta

### Get aggregate TVL metrics for a protocol

​#Copy link

Returns protocol metadata along with current TVL figures, chain breakdowns, and other aggregate metrics.

Path Parameters

- protocol

Type: string

required



Example

aave











protocol slug


Responses

- 200


Protocol TVL metrics





application/json

- 404









Protocol not found


Request Example for get/api/v2/metrics/tvl/protocol/ _{protocol}_

Shell Curl

Copy content

```curl
curl 'https://pro-api.llama.fi/<API-KEY>/api/v2/metrics/tvl/protocol/%7Bprotocol%7D'
```

Test Request(get /api/v2/metrics/tvl/protocol/{protocol})

Status: 200Status: 404

Show Schema

Copy content

```json
{
  "id": "parent#aave",
  "name": "Aave",
  "url": "https://aave.com",
  "description": "Aave is an Open Source and Non-Custodial protocol to earn interest on deposits and borrow assets",
  "logo": "https://icons.llama.fi/aave.png",
  "chains": [],
  "gecko_id": "aave",
  "cmcId": "7278",
  "treasury": "aave.js",
  "twitter": "aave",
  "governanceID": [\
    "snapshot:aave.eth",\
    "eip155:1:0xEC568fffba86c094cf06b22134B23074DFE2252c"\
  ],
  "wrongLiquidity": true,
  "github": [\
    "aave",\
    "bgd-labs"\
  ],
  "stablecoins": [\
    "gho"\
  ],
  "tokenRights": {
    "rights": [\
      {\
        "label": "Governance",\
        "hasRight": true,\
        "details": "AAVE"\
      },\
      {\
        "label": "Treasury",\
        "hasRight": true,\
        "details": "AAVE"\
      },\
      {\
        "label": "Revenue",\
        "hasRight": true,\
        "details": "AAVE"\
      }\
    ],
    "governanceData": {
      "rights": "LIMITED",
      "details": "Governance includes protocol parameters, treasury management, upgrades & onchain revenue",
      "feeSwitchStatus": "ON",
      "feeSwitchDetails": "$50m annual budget for token buybacks"
    },
    "holdersRevenueAndValueAccrual": {
      "buybacks": "ACTIVE",
      "dividends": "NONE",
      "burns": "NONE",
      "primaryValueAccrual": "Buybacks - $50M yearly budget for buybacks"
    },
    "tokenAlignment": {
      "fundraising": "TOKEN",
      "raiseDetailsLink": {
        "label": "Strategic Round (Decrypt)",
        "url": "https://decrypt.co/44653/aave-raises-25-million-to-bring-defi-to-institutions"
      },
      "associatedEntities": [\
        "DAO",\
        "Labs",\
        "Parent / Holdings Co"\
      ],
      "equityRevenueCapture": "PARTIAL",
      "equityStatement": "Labs owns the interface and offchain revenue"
    }
  },
  "symbol": "AAVE",
  "address": "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9",
  "currentChainTvls": {
    "Ethereum-staking": 300390294,
    "Ethereum-pool2": 1001784,
    "Avalanche-borrowed": 230805193,
    "Ethereum": 21541108640,
    "Ethereum-borrowed": 13105470847,
    "Polygon": 164069009,
    "Avalanche": 425186004,
    "Polygon-borrowed": 71777370,
    "staking": 300390294,
    "pool2": 1001784,
    "borrowed": 16477546481,
    "Base": 720897079,
    "Base-borrowed": 539408955,
    "Arbitrum": 710909114,
    "Arbitrum-borrowed": 493502165,
    "OP Mainnet": 53112825,
    "OP Mainnet-borrowed": 30898499,
    "Gnosis": 67454440,
    "Gnosis-borrowed": 28683972,
    "Mantle": 285136854,
    "Mantle-borrowed": 186143806,
    "Plasma": 1958242285,
    "Plasma-borrowed": 1655750534,
    "BSC": 174954075,
    "BSC-borrowed": 70470380,
    "Linea": 49717184,
    "Linea-borrowed": 38569924,
    "Sonic": 12939987,
    "Sonic-borrowed": 5315322,
    "Scroll": 6971724,
    "Scroll-borrowed": 5290161,
    "ZKsync Era": 2782917,
    "ZKsync Era-borrowed": 1245328,
    "Soneium": 2038301,
    "Soneium-borrowed": 292179,
    "Metis": 959354,
    "Metis-borrowed": 159370,
    "Celo": 13373563,
    "Celo-borrowed": 4923675,
    "MegaETH": 19380664,
    "MegaETH-borrowed": 34443,
    "Aptos": 18649107,
    "Aptos-borrowed": 8493938,
    "Fantom": 4575,
    "Fantom-borrowed": 1034,
    "Harmony": 0,
    "Harmony-borrowed": 309375
  },
  "isParentProtocol": true,
  "raises": [\
    {\
      "date": 1594771200,\
      "name": "Aave",\
      "round": "Private token sale",\
      "amount": 3,\
      "source": "https://www.dcforecasts.com/altcoin-news/aave-raises-3m-from-three-arrows-capital-and-framework-ventures/",\
      "leadInvestors": [\
        "Framework Ventures",\
        "3AC"\
      ],\
      "otherInvestors": [],\
      "valuation": null,\
      "defillamaId": "111"\
    },\
    {\
      "date": 1602460800,\
      "name": "Aave",\
      "round": "Strategic ",\
      "amount": 25,\
      "source": "https://decrypt.co/44653/aave-raises-25-million-to-bring-defi-to-institutions",\
      "leadInvestors": [\
        "Blockchain Capital",\
        "Blockchain.com Ventures",\
        "Standard Crypto"\
      ],\
      "otherInvestors": [],\
      "valuation": null,\
      "defillamaId": "111"\
    },\
    {\
      "date": 1594166400,\
      "name": "Aave",\
      "round": "Private token sale",\
      "amount": 4.5,\
      "source": "https://decrypt.co/34991/parafi-invests-defi-lending-protocol",\
      "leadInvestors": [\
        "ParaFi Capital"\
      ],\
      "otherInvestors": [],\
      "valuation": null,\
      "defillamaId": "111"\
    },\
    {\
      "date": 1512000000,\
      "name": "Aave",\
      "round": "ICO",\
      "amount": 16.2,\
      "source": "https://twitter.com/aaveaave/status/936247348816175104",\
      "leadInvestors": [],\
      "otherInvestors": [],\
      "valuation": null,\
      "defillamaId": "1838"\
    }\
  ],
  "mcap": 1775192426.0010407,
  "otherProtocols": [\
    "Aave",\
    "Aave V3",\
    "Aave Horizon RWA",\
    "Aave V2",\
    "Aave Aptos",\
    "Aave V1",\
    "Aave Arc"\
  ],
  "hallmarks": [\
    [\
      1619395200,\
      "Start Ethereum V2 Rewards"\
    ],\
    [\
      1633305600,\
      "Start AVAX V2 Rewards"\
    ],\
    [\
      1635292800,\
      "Potential xSUSHI attack found"\
    ],\
    [\
      1650412800,\
      "Start AVAX Rewards"\
    ],\
    [\
      1651881600,\
      "UST depeg"\
    ],\
    [\
      1654819200,\
      "stETH depeg"\
    ],\
    [\
      1659571200,\
      "Start OP Rewards"\
    ]\
  ]
}
```

Protocol TVL metrics

API Plan

Beta

### Get historical TVL chart for a protocol

​#Copy link

Returns an array of \[timestamp, value\] pairs representing the protocol's TVL over time. By default returns the base TVL metric. Use the `key` parameter to select a different metric or aggregate all metrics.

Path Parameters

- protocol

Type: string

required



Example

uniswap











protocol slug


Query Parameters

- key

Type: stringenum

Example

all











Metric to return. Omit for default TVL. Use "all" for the sum of tvl+borrowed+staking+pool2+vesting, or a specific metric like "staking", "borrowed", "vesting", "pool2".









  - all

  - staking

  - borrowed

  - vesting

  - pool2


Responses

- 200


Array of \[timestamp, value\] pairs





application/json

- 404









Protocol not found


Request Example for get/api/v2/chart/tvl/protocol/ _{protocol}_

Shell Curl

Copy content

```curl
curl 'https://pro-api.llama.fi/<API-KEY>/api/v2/chart/tvl/protocol/%7Bprotocol%7D'
```

Test Request(get /api/v2/chart/tvl/protocol/{protocol})

Status: 200Status: 404

Show Schema

Copy content

```json
[\
  [\
    1609459200,\
    5200000000\
  ]\
]
```

Array of \[timestamp, value\] pairs

API Plan

Beta

### Get historical TVL chart for a protocol broken down by chain

​#Copy link

Returns an array of \[timestamp, { chain: value }\] pairs showing the selected metric per chain over time.

Path Parameters

- protocol

Type: string

required



Example

euler











protocol slug


Query Parameters

- key

Type: stringenum

Example

borrowed











Metric to return. Omit for default TVL. Use "all" for the sum of tvl+borrowed+staking+pool2+vesting, or a specific metric like "staking", "borrowed", "vesting", "pool2".









  - all

  - staking

  - borrowed

  - vesting

  - pool2


Responses

- 200


Array of \[timestamp, chainBreakdown\] pairs. Each entry is a two-element array: first element is a unix timestamp, second is an object mapping chain names to values.





application/json

- 404









Protocol not found


Request Example for get/api/v2/chart/tvl/protocol/ _{protocol}_/chain-breakdown

Shell Curl

Copy content

```curl
curl 'https://pro-api.llama.fi/<API-KEY>/api/v2/chart/tvl/protocol/%7Bprotocol%7D/chain-breakdown'
```

Test Request(get /api/v2/chart/tvl/protocol/{protocol}/chain-breakdown)

Status: 200Status: 404

Show Schema

Copy content

```json
[\
  [\
    1609459200,\
    {\
      "Ethereum": 3200000000,\
      "Polygon": 1500000000\
    }\
  ],\
  [\
    1609545600,\
    {\
      "Ethereum": 3250000000,\
      "Polygon": 1520000000\
    }\
  ]\
]
```

Array of \[timestamp, chainBreakdown\] pairs. Each entry is a two-element array: first element is a unix timestamp, second is an object mapping chain names to values.

API Plan

Beta

### Get historical TVL chart for a protocol broken down by token

​#Copy link

Returns an array of \[timestamp, { token: value }\] pairs showing TVL per token over time. Values are in USD by default, set currency=tokens for raw token amounts.

Path Parameters

- protocol

Type: string

required



Example

aave











protocol slug


Query Parameters

- key

Type: stringenum







Metric to return. Omit for default TVL. Use "all" for the sum of tvl+borrowed+staking+pool2+vesting, or a specific metric like "staking", "borrowed", "vesting", "pool2".









  - all

  - staking

  - borrowed

  - vesting

  - pool2


- currency

Type: stringenum

Example

usd











Set to "tokens" to return values denominated in raw token amounts instead of USD









  - usd

  - token

  - raw


Responses

- 200


Array of \[timestamp, tokenBreakdown\] pairs. Each entry is a two-element array: first element is a unix timestamp, second is an object mapping token names to values (USD by default, raw token amounts if currency=tokens).





application/json

- 404









Protocol not found


Request Example for get/api/v2/chart/tvl/protocol/ _{protocol}_/token-breakdown

Shell Curl

Copy content

```curl
curl 'https://pro-api.llama.fi/<API-KEY>/api/v2/chart/tvl/protocol/%7Bprotocol%7D/token-breakdown'
```

Test Request(get /api/v2/chart/tvl/protocol/{protocol}/token-breakdown)

Status: 200Status: 404

Show Schema

Copy content

```json
[\
  [\
    1609459200,\
    {\
      "USDC": 1000000000,\
      "USDT": 800000000,\
      "WETH": 500000000\
    }\
  ],\
  [\
    1609545600,\
    {\
      "USDC": 1010000000,\
      "USDT": 810000000,\
      "WETH": 510000000\
    }\
  ]\
]
```

Array of \[timestamp, tokenBreakdown\] pairs. Each entry is a two-element array: first element is a unix timestamp, second is an object mapping token names to values (USD by default, raw token amounts if currency=tokens).

## coins  (Collapsed)

​#Copy link

General blockchain data used by defillama and open-sourced

coins Operations

- [get/prices/current/{coins}](https://api-docs.defillama.com/#tag/coins/get/prices/current/{coins})
- [get/prices/historical/{timestamp}/{coins}](https://api-docs.defillama.com/#tag/coins/get/prices/historical/{timestamp}/{coins})
- [get/batchHistorical](https://api-docs.defillama.com/#tag/coins/get/batchHistorical)
- [get/chart/{coins}](https://api-docs.defillama.com/#tag/coins/get/chart/{coins})
- [get/percentage/{coins}](https://api-docs.defillama.com/#tag/coins/get/percentage/{coins})
- [get/prices/first/{coins}](https://api-docs.defillama.com/#tag/coins/get/prices/first/{coins})
- [get/block/{chain}/{timestamp}](https://api-docs.defillama.com/#tag/coins/get/block/{chain}/{timestamp})

Show More

## stablecoins  (Collapsed)

​#Copy link

Data from our stablecoins dashboard

stablecoins Operations

- [get/stablecoins](https://api-docs.defillama.com/#tag/stablecoins/get/stablecoins)
- [get/stablecoincharts/all](https://api-docs.defillama.com/#tag/stablecoins/get/stablecoincharts/all)
- [get/stablecoincharts/{chain}](https://api-docs.defillama.com/#tag/stablecoins/get/stablecoincharts/{chain})
- [get/stablecoin/{asset}](https://api-docs.defillama.com/#tag/stablecoins/get/stablecoin/{asset})
- [get/stablecoinchains](https://api-docs.defillama.com/#tag/stablecoins/get/stablecoinchains)
- [get/stablecoinprices](https://api-docs.defillama.com/#tag/stablecoins/get/stablecoinprices)
- [get/stablecoins/stablecoindominance/{chain}  API Plan](https://api-docs.defillama.com/#tag/stablecoins/get/stablecoins/stablecoindominance/{chain})

Show More

## yields  (Collapsed)

​#Copy link

Data from our yields/APY dashboard

yields Operations

- [get/pools](https://api-docs.defillama.com/#tag/yields/get/pools)
- [get/chart/{pool}](https://api-docs.defillama.com/#tag/yields/get/chart/{pool})
- [get/yields/poolsOld  API Plan](https://api-docs.defillama.com/#tag/yields/get/yields/poolsOld)
- [get/yields/poolsBorrow  API Plan](https://api-docs.defillama.com/#tag/yields/get/yields/poolsBorrow)
- [get/yields/chartLendBorrow/{pool}  API Plan](https://api-docs.defillama.com/#tag/yields/get/yields/chartLendBorrow/{pool})
- [get/yields/perps  API Plan](https://api-docs.defillama.com/#tag/yields/get/yields/perps)
- [get/yields/lsdRates  API Plan](https://api-docs.defillama.com/#tag/yields/get/yields/lsdRates)

Show More

## volumes  (Collapsed)

​#Copy link

Data from our volumes dashboards

volumes Operations

- [get/overview/dexs](https://api-docs.defillama.com/#tag/volumes/get/overview/dexs)
- [get/overview/dexs/{chain}](https://api-docs.defillama.com/#tag/volumes/get/overview/dexs/{chain})
- [get/summary/dexs/{protocol}](https://api-docs.defillama.com/#tag/volumes/get/summary/dexs/{protocol})
- [get/overview/options](https://api-docs.defillama.com/#tag/volumes/get/overview/options)
- [get/overview/options/{chain}](https://api-docs.defillama.com/#tag/volumes/get/overview/options/{chain})
- [get/summary/options/{protocol}](https://api-docs.defillama.com/#tag/volumes/get/summary/options/{protocol})

Show More

## fees and revenue  (Collapsed)

​#Copy link

Data from our fees and revenue dashboard

fees and revenue Operations

- [get/overview/fees](https://api-docs.defillama.com/#tag/fees-and-revenue/get/overview/fees)
- [get/overview/fees/{chain}](https://api-docs.defillama.com/#tag/fees-and-revenue/get/overview/fees/{chain})
- [get/summary/fees/{protocol}](https://api-docs.defillama.com/#tag/fees-and-revenue/get/summary/fees/{protocol})

Show More

## perps  (Collapsed)

​#Copy link

perps Operations

- [get/overview/open-interest](https://api-docs.defillama.com/#tag/perps/get/overview/open-interest)
- [get/api/overview/derivatives  API Plan](https://api-docs.defillama.com/#tag/perps/get/api/overview/derivatives)
- [get/api/summary/derivatives/{protocol}  API Plan](https://api-docs.defillama.com/#tag/perps/get/api/summary/derivatives/{protocol})

Show More

## Unlocks  (Collapsed)

​#Copy link

Unlocks Operations

- [get/api/emissions  API Plan](https://api-docs.defillama.com/#tag/unlocks/get/api/emissions)
- [get/api/emission/{protocol}  API Plan](https://api-docs.defillama.com/#tag/unlocks/get/api/emission/{protocol})

Show More

## main page  (Collapsed)

​#Copy link

main page Operations

- [get/api/categories  API Plan](https://api-docs.defillama.com/#tag/main-page/get/api/categories)
- [get/api/forks  API Plan](https://api-docs.defillama.com/#tag/main-page/get/api/forks)
- [get/api/oracles  API Plan](https://api-docs.defillama.com/#tag/main-page/get/api/oracles)
- [get/api/hacks  API Plan](https://api-docs.defillama.com/#tag/main-page/get/api/hacks)
- [get/api/raises  API Plan](https://api-docs.defillama.com/#tag/main-page/get/api/raises)
- [get/api/treasuries  API Plan](https://api-docs.defillama.com/#tag/main-page/get/api/treasuries)
- [get/api/entities  API Plan](https://api-docs.defillama.com/#tag/main-page/get/api/entities)

Show More

## token liquidity  (Collapsed)

​#Copy link

token liquidity Operations

- [get/api/historicalLiquidity/{token}  API Plan](https://api-docs.defillama.com/#tag/token-liquidity/get/api/historicalLiquidity/{token})

Show More

## Treasury  (Collapsed)

​#Copy link

Treasury Operations

- [get/api/v2/metrics/treasury/protocol/{protocol}  API Plan  Beta](https://api-docs.defillama.com/#tag/treasury/get/api/v2/metrics/treasury/protocol/{protocol})
- [get/api/v2/chart/treasury/protocol/{protocol}  API Plan  Beta](https://api-docs.defillama.com/#tag/treasury/get/api/v2/chart/treasury/protocol/{protocol})
- [get/api/v2/chart/treasury/protocol/{protocol}/chain-breakdown  API Plan  Beta](https://api-docs.defillama.com/#tag/treasury/get/api/v2/chart/treasury/protocol/{protocol}/chain-breakdown)
- [get/api/v2/chart/treasury/protocol/{protocol}/token-breakdown  API Plan  Beta](https://api-docs.defillama.com/#tag/treasury/get/api/v2/chart/treasury/protocol/{protocol}/token-breakdown)

Show More

## Oracles  (Collapsed)

​#Copy link

Oracles Operations

- [get/api/v2/metrics/oracle  API Plan  Beta](https://api-docs.defillama.com/#tag/oracles/get/api/v2/metrics/oracle)
- [get/api/v2/chart/oracle  API Plan  Beta](https://api-docs.defillama.com/#tag/oracles/get/api/v2/chart/oracle)
- [get/api/v2/chart/oracle/chain-breakdown  API Plan  Beta](https://api-docs.defillama.com/#tag/oracles/get/api/v2/chart/oracle/chain-breakdown)
- [get/api/v2/chart/oracle/protocol-breakdown  API Plan  Beta](https://api-docs.defillama.com/#tag/oracles/get/api/v2/chart/oracle/protocol-breakdown)
- [get/api/v2/chart/oracle/protocol/{protocol}  API Plan  Beta](https://api-docs.defillama.com/#tag/oracles/get/api/v2/chart/oracle/protocol/{protocol})
- [get/api/v2/chart/oracle/protocol/{protocol}/chain-breakdown  API Plan  Beta](https://api-docs.defillama.com/#tag/oracles/get/api/v2/chart/oracle/protocol/{protocol}/chain-breakdown)
- [get/api/v2/chart/oracle/chain/{chain}  API Plan  Beta](https://api-docs.defillama.com/#tag/oracles/get/api/v2/chart/oracle/chain/{chain})
- [get/api/v2/chart/oracle/chain/{chain}/protocol-breakdown  API Plan  Beta](https://api-docs.defillama.com/#tag/oracles/get/api/v2/chart/oracle/chain/{chain}/protocol-breakdown)

Show More

## Forks  (Collapsed)

​#Copy link

Forks Operations

- [get/api/v2/metrics/fork  API Plan  Beta](https://api-docs.defillama.com/#tag/forks/get/api/v2/metrics/fork)
- [get/api/v2/chart/fork/protocol-breakdown  API Plan  Beta](https://api-docs.defillama.com/#tag/forks/get/api/v2/chart/fork/protocol-breakdown)
- [get/api/v2/chart/fork/protocol/{protocol}  API Plan  Beta](https://api-docs.defillama.com/#tag/forks/get/api/v2/chart/fork/protocol/{protocol})

Show More

## Dimensions  (Collapsed)

​#Copy link

Dimensions Operations

- [get/api/v2/metrics/{metric}  API Plan  Beta](https://api-docs.defillama.com/#tag/dimensions/get/api/v2/metrics/{metric})
- [get/api/v2/chart/{metric}  API Plan  Beta](https://api-docs.defillama.com/#tag/dimensions/get/api/v2/chart/{metric})
- [get/api/v2/chart/{metric}/chain-breakdown  API Plan  Beta](https://api-docs.defillama.com/#tag/dimensions/get/api/v2/chart/{metric}/chain-breakdown)
- [get/api/v2/chart/{metric}/protocol-breakdown  API Plan  Beta](https://api-docs.defillama.com/#tag/dimensions/get/api/v2/chart/{metric}/protocol-breakdown)
- [get/api/v2/metrics/{metric}/chain/{chain}  API Plan  Beta](https://api-docs.defillama.com/#tag/dimensions/get/api/v2/metrics/{metric}/chain/{chain})
- [get/api/v2/chart/{metric}/chain/{chain}  API Plan  Beta](https://api-docs.defillama.com/#tag/dimensions/get/api/v2/chart/{metric}/chain/{chain})
- [get/api/v2/chart/{metric}/chain/{chain}/protocol-breakdown  API Plan  Beta](https://api-docs.defillama.com/#tag/dimensions/get/api/v2/chart/{metric}/chain/{chain}/protocol-breakdown)
- [get/api/v2/metrics/{metric}/protocol/{protocol}  API Plan  Beta](https://api-docs.defillama.com/#tag/dimensions/get/api/v2/metrics/{metric}/protocol/{protocol})
- [get/api/v2/chart/{metric}/protocol/{protocol}  API Plan  Beta](https://api-docs.defillama.com/#tag/dimensions/get/api/v2/chart/{metric}/protocol/{protocol})
- [get/api/v2/chart/{metric}/protocol/{protocol}/chain-breakdown  API Plan  Beta](https://api-docs.defillama.com/#tag/dimensions/get/api/v2/chart/{metric}/protocol/{protocol}/chain-breakdown)
- [get/api/v2/chart/{metric}/protocol/{protocol}/version-breakdown  API Plan  Beta](https://api-docs.defillama.com/#tag/dimensions/get/api/v2/chart/{metric}/protocol/{protocol}/version-breakdown)
- [get/api/v2/chart/{metric}/protocol/{protocol}/label-breakdown  API Plan  Beta](https://api-docs.defillama.com/#tag/dimensions/get/api/v2/chart/{metric}/protocol/{protocol}/label-breakdown)
- [get/api/v2/metrics/{metric}/category/{category}  API Plan  Beta](https://api-docs.defillama.com/#tag/dimensions/get/api/v2/metrics/{metric}/category/{category})
- [get/api/v2/chart/{metric}/category/{category}  API Plan  Beta](https://api-docs.defillama.com/#tag/dimensions/get/api/v2/chart/{metric}/category/{category})
- [get/api/v2/chart/{metric}/category/{category}/chain-breakdown  API Plan  Beta](https://api-docs.defillama.com/#tag/dimensions/get/api/v2/chart/{metric}/category/{category}/chain-breakdown)
- [get/api/v2/chart/{metric}/category/{category}/protocol-breakdown  API Plan  Beta](https://api-docs.defillama.com/#tag/dimensions/get/api/v2/chart/{metric}/category/{category}/protocol-breakdown)
- [get/api/v2/metrics/{metric}/category/{category}/chain/{chain}  API Plan  Beta](https://api-docs.defillama.com/#tag/dimensions/get/api/v2/metrics/{metric}/category/{category}/chain/{chain})
- [get/api/v2/chart/{metric}/category/{category}/chain/{chain}  API Plan  Beta](https://api-docs.defillama.com/#tag/dimensions/get/api/v2/chart/{metric}/category/{category}/chain/{chain})
- [get/api/v2/chart/{metric}/category/{category}/chain/{chain}/protocol-breakdown  API Plan  Beta](https://api-docs.defillama.com/#tag/dimensions/get/api/v2/chart/{metric}/category/{category}/chain/{chain}/protocol-breakdown)

Show More

## Financial Statements  (Collapsed)

​#Copy link

Financial Statements Operations

- [get/api/v2/metrics/financial-statement/protocol/{protocol}  API Plan  Beta](https://api-docs.defillama.com/#tag/financial-statements/get/api/v2/metrics/financial-statement/protocol/{protocol})

Show More

## ETFs  (Collapsed)

​#Copy link

ETFs Operations

- [get/etfs/snapshot  API Plan](https://api-docs.defillama.com/#tag/etfs/get/etfs/snapshot)
- [get/etfs/flows  API Plan](https://api-docs.defillama.com/#tag/etfs/get/etfs/flows)

Show More

## narratives  (Collapsed)

​#Copy link

narratives Operations

- [get/fdv/performance/{period}  API Plan](https://api-docs.defillama.com/#tag/narratives/get/fdv/performance/{period})

Show More

## bridges  (Collapsed)

​#Copy link

bridges Operations

- [get/bridges/bridges  API Plan](https://api-docs.defillama.com/#tag/bridges/get/bridges/bridges)
- [get/bridges/bridge/{id}  API Plan](https://api-docs.defillama.com/#tag/bridges/get/bridges/bridge/{id})
- [get/bridges/bridgevolume/{chain}  API Plan](https://api-docs.defillama.com/#tag/bridges/get/bridges/bridgevolume/{chain})
- [get/bridges/bridgedaystats/{timestamp}/{chain}  API Plan](https://api-docs.defillama.com/#tag/bridges/get/bridges/bridgedaystats/{timestamp}/{chain})
- [get/bridges/transactions/{id}  API Plan](https://api-docs.defillama.com/#tag/bridges/get/bridges/transactions/{id})

Show More

## meta  (Collapsed)

​#Copy link

meta Operations

- [get/usage/APIKEY  API Plan](https://api-docs.defillama.com/#tag/meta/get/usage/APIKEY)

Show More

## DAT  (Collapsed)

​#Copy link

DAT Operations

- [get/dat/institutions  API Plan](https://api-docs.defillama.com/#tag/dat/get/dat/institutions)
- [get/dat/institutions/{symbol}  API Plan](https://api-docs.defillama.com/#tag/dat/get/dat/institutions/{symbol})

Show More

## Equities  (Collapsed)

​#Copy link

Equities Operations

- [get/equities/v1/companies  API Plan](https://api-docs.defillama.com/#tag/equities/get/equities/v1/companies)
- [get/equities/v1/statements  API Plan](https://api-docs.defillama.com/#tag/equities/get/equities/v1/statements)
- [get/equities/v1/price-history  API Plan](https://api-docs.defillama.com/#tag/equities/get/equities/v1/price-history)
- [get/equities/v1/ohlcv  API Plan](https://api-docs.defillama.com/#tag/equities/get/equities/v1/ohlcv)
- [get/equities/v1/summary  API Plan](https://api-docs.defillama.com/#tag/equities/get/equities/v1/summary)
- [get/equities/v1/filings  API Plan](https://api-docs.defillama.com/#tag/equities/get/equities/v1/filings)

Show More

## RWA  (Collapsed)

​#Copy link

RWA Operations

- [get/rwa/current  API Plan](https://api-docs.defillama.com/#tag/rwa/get/rwa/current)
- [get/rwa/stats  API Plan](https://api-docs.defillama.com/#tag/rwa/get/rwa/stats)
- [get/rwa/list  API Plan](https://api-docs.defillama.com/#tag/rwa/get/rwa/list)
- [get/rwa/chain/{chain}  API Plan](https://api-docs.defillama.com/#tag/rwa/get/rwa/chain/{chain})
- [get/rwa/chart/chain/{chain}  API Plan](https://api-docs.defillama.com/#tag/rwa/get/rwa/chart/chain/{chain})
- [get/rwa/chart/chain-breakdown  API Plan](https://api-docs.defillama.com/#tag/rwa/get/rwa/chart/chain-breakdown)

Show More

Show sidebar

Show search

- Close Group

TVL










  - [List all protocols on defillama along with their tvl\\
    \\
    HTTP Method:\\
    GET](https://api-docs.defillama.com/workspace/default/request/CNRE7DcRg97EeTAs1-46J)

  - [Get historical TVL of a protocol and breakdowns by token and chain\\
    \\
    HTTP Method:\\
    GET](https://api-docs.defillama.com/workspace/default/request/P8brNsl4R_yqJdMHrB9vM)

  - [Get historical TVL (excludes liquid staking and double counted tvl) of DeFi on all chains\\
    \\
    HTTP Method:\\
    GET](https://api-docs.defillama.com/workspace/default/request/9a__MWh8TxJSuWw7K_D_7)

  - [Get historical TVL (excludes liquid staking and double counted tvl) of a chain\\
    \\
    HTTP Method:\\
    GET](https://api-docs.defillama.com/workspace/default/request/-rcHM_l3hjjWNjmieCegJ)

  - [Simplified endpoint to get current TVL of a protocol\\
    \\
    HTTP Method:\\
    GET](https://api-docs.defillama.com/workspace/default/request/FMOJQ5t4UdBGhYxXcAMtf)

  - [Get current TVL of all chains\\
    \\
    HTTP Method:\\
    GET](https://api-docs.defillama.com/workspace/default/request/v-NPrOLSk5q3vAMVXT6WA)

  - [Lists the amount of a certain token within all protocols. Data for the Token Usage page\\
    \\
    HTTP Method:\\
    GET](https://api-docs.defillama.com/workspace/default/request/DhuPFUVpVPe1HR9UXHEez)

  - [Lists the amount of inflows and outflows for a protocol at a given date\\
    \\
    HTTP Method:\\
    GET](https://api-docs.defillama.com/workspace/default/request/mS36oRZwI-HczKLKiebKb)

  - [Get assets of all chains\\
    \\
    HTTP Method:\\
    GET](https://api-docs.defillama.com/workspace/default/request/oj6jrjKU-In91DXzjDFNZ)

  - [Get aggregate TVL metrics for a protocol\\
    \\
    HTTP Method:\\
    GET](https://api-docs.defillama.com/workspace/default/request/Zxpa_vzirA8Wa67ov1BJ8)

  - [Get historical TVL chart for a protocol\\
    \\
    HTTP Method:\\
    GET](https://api-docs.defillama.com/workspace/default/request/w2KcnUftScPC0-lRJlJyu)

  - [Get historical TVL chart for a protocol broken down by chain\\
    \\
    HTTP Method:\\
    GET](https://api-docs.defillama.com/workspace/default/request/2ZwIsa-u1ZLd1I5TvIGAZ)

  - [Get historical TVL chart for a protocol broken down by token\\
    \\
    HTTP Method:\\
    GET](https://api-docs.defillama.com/workspace/default/request/HzOCUIgpiom1l-tmuFq5J)


- Open Group

coins

- Open Group

stablecoins

- Open Group

yields

- Open Group

volumes

- Open Group

fees and revenue

- Open Group

perps

- Open Group

Unlocks

- Open Group

main page

- Open Group

token liquidity

- Open Group

Treasury

- Open Group

Oracles

- Open Group

Forks

- Open Group

Dimensions

- Open Group

Financial Statements

- Open Group

ETFs

- Open Group

narratives

- Open Group

bridges

- Open Group

meta

- Open Group

DAT

- Open Group

Equities

- Open Group

RWA


GET

Server: https://api.llama.fi

/protocols

Copy complete URL to clipboardSend Send get request to https://api.llama.fi/protocols

Close ClientClose Client

List all protocols on defillama along with their tvl

AllCookiesHeadersQuery

All

## Variables

## Cookies

| Cookie Enabled | Cookie Key | Cookie Value |
| --- | --- | --- |
|  | Key | Value |

## Headers

Clear All Headers

| Header Enabled | Header Key | Header Value |
| --- | --- | --- |
|  | Accept | \*/\* |
|  | Key | Value |

## Query Parameters

| Parameter Enabled | Parameter Key | Parameter Value |
| --- | --- | --- |
|  | Key | Value |

## Code Snippet (Collapsed)

JavaScript SDK

Response

AllCookiesHeadersBody

All

[Powered By Scalar.com](https://www.scalar.com/)

.,,uod8B8bou,,. ..,uod8BBBBBBBBBBBBBBBBRPFT?l!i:. \|\|\|\|\|\|\|\|\|\|\|\|\|\|!?TFPRBBBBBBBBBBBBBBB8m=, \|\|\|\| '""^^!!\|\|\|\|\|\|\|\|\|\|TFPRBBBVT!:...! \|\|\|\| '""^^!!\|\|\|\|\|?!:.......! \|\|\|\| \|\|\|\|.........! \|\|\|\| \|\|\|\|.........! \|\|\|\| \|\|\|\|.........! \|\|\|\| \|\|\|\|.........! \|\|\|\| \|\|\|\|.........! \|\|\|\| \|\|\|\|.........! \|\|\|\|, \|\|\|\|.........\` \|\|\|\|\|!!-.\_ \|\|\|\|.......;. ':!\|\|\|\|\|\|\|\|\|!!-.\_ \|\|\|\|.....bBBBBWdou,. bBBBBB86foi!\|\|\|\|\|\|\|!!-..:\|\|\|!..bBBBBBBBBBBBBBBY! ::!?TFPRBBBBBB86foi!\|\|\|\|\|\|\|\|!!bBBBBBBBBBBBBBBY..! :::::::::!?TFPRBBBBBB86ftiaabBBBBBBBBBBBBBBY....! :::;\`"^!:;::::::!?TFPRBBBBBBBBBBBBBBBBBBBY......! ;::::::...''^::::::::::!?TFPRBBBBBBBBBBY........! .ob86foi;::::::::::::::::::::::::!?TFPRBY..........\` .b888888888886foi;:::::::::::::::::::::::..........\` .b888888888888888888886foi;::::::::::::::::...........b888888888888888888888888888886foi;:::::::::......\`!Tf998888888888888888888888888888888886foi;:::....\` '"^!\|Tf9988888888888888888888888888888888!::..\` '"^!\|Tf998888888888888888888888889!! '\` '"^!\|Tf9988888888888888888!!\` iBBbo. '"^!\|Tf998888888889!\` WBBBBbo. '"^!\|Tf9989!\` YBBBP^' '"^!\` \`

Send Request
^ ↵Control Enter