import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const protocols = [
  {
    name: "Hyperlend",
    logo: "https://images.unsplash.com/photo-1639322537504-6427a16b0a28?w=96&q=80&auto=format&fit=crop",
    color: "bg-cyan-500",
    rewards: [
      "https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=48&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=48&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1642052502435-0f5d128a4d2f?w=48&q=80&auto=format&fit=crop",
    ],
    tvl: "$3.43M",
    borrowRate: "0.05% APY",
    supplyRate: "0.05% APY",
    category: "DEX",
  },
  {
    name: "Pendle",
    logo: "https://images.unsplash.com/photo-1642104704074-907c0698cbd9?w=96&q=80&auto=format&fit=crop",
    color: "bg-slate-400",
    rewards: [
      "https://images.unsplash.com/photo-1642104704074-907c0698cbd9?w=48&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1620321023374-d1a68fbc720d?w=48&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1639322537504-6427a16b0a28?w=48&q=80&auto=format&fit=crop",
    ],
    tvl: "$2.11M",
    borrowRate: "0.07% APY",
    supplyRate: "0.03% APY",
    category: "Yield",
  },
  {
    name: "Project X",
    logo: "https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=96&q=80&auto=format&fit=crop",
    color: "bg-white",
    rewards: [
      "https://images.unsplash.com/photo-1639322537504-6427a16b0a28?w=48&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1642104704074-907c0698cbd9?w=48&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=48&q=80&auto=format&fit=crop",
    ],
    tvl: "$5.20M",
    borrowRate: "0.06% APY",
    supplyRate: "0.04% APY",
    category: "DEX",
  },
  {
    name: "Valantis",
    logo: "https://images.unsplash.com/photo-1642052502435-0f5d128a4d2f?w=96&q=80&auto=format&fit=crop",
    color: "bg-slate-300",
    rewards: [
      "https://images.unsplash.com/photo-1620321023374-d1a68fbc720d?w=48&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1639322537504-6427a16b0a28?w=48&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1642052502435-0f5d128a4d2f?w=48&q=80&auto=format&fit=crop",
    ],
    tvl: "$1.89M",
    borrowRate: "0.04% APY",
    supplyRate: "0.02% APY",
    category: "Lending",
  },
  {
    name: "Hydra",
    logo: "https://images.unsplash.com/photo-1620321023374-d1a68fbc720d?w=96&q=80&auto=format&fit=crop",
    color: "bg-cyan-600",
    rewards: [
      "https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=48&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1642104704074-907c0698cbd9?w=48&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1642052502435-0f5d128a4d2f?w=48&q=80&auto=format&fit=crop",
    ],
    tvl: "$6.42M",
    borrowRate: "0.08% APY",
    supplyRate: "0.05% APY",
    category: "Lending",
  },
];

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET',
      },
      body: JSON.stringify({ markets: protocols }),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};