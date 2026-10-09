// Forward only the explicitly provided lifetime totals, never wallet balances or other account fields.
export function projectUsage(value,now=Date.now()){
 if(!value||!Array.isArray(value.total_costs)||!value.total_costs.length)return {status:'unavailable',reason:'missing-total'};
 const currencies=new Set(),totals=[];
 for(const item of value.total_costs){
  if(!item||!['CNY','USD'].includes(item.currency)||currencies.has(item.currency)||typeof item.amount!=='string'||!/^\d+(?:\.\d+)?$/.test(item.amount)||!Number.isFinite(Number(item.amount))||Number(item.amount)>Number.MAX_SAFE_INTEGER)return {status:'unavailable',reason:'invalid-total'};
  currencies.add(item.currency);totals.push({currency:item.currency,amount:item.amount});
 }
 return {status:'ready',totals,scope:'account-lifetime',source:'platform-user-summary',updatedAt:now};
}
