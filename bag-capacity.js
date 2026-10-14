export function bagUpgradeOffer(state){
 const capacity=state.capacity;if(!Number.isInteger(capacity)||capacity<0||capacity>1000)throw Error('背包容量无效');
 return {capacity,nextCapacity:capacity+12,price:2000+1000*Math.max(0,Math.floor((capacity-24)/12)),available:capacity+12<=1000};
}
export function bagUpgradeTransaction(state,expectedCapacity=state.capacity){
 if(expectedCapacity!==state.capacity)throw Error('背包容量已变化，请重新点击升级');const offer=bagUpgradeOffer(state);if(!offer.available)throw Error('背包已达容量上限');if(state.gold<offer.price)throw Error('金币不足 '+offer.price+'g');
 return {gold:-offer.price,capacity:offer.nextCapacity,items:[],description:'背包已从'+offer.capacity+'格扩充至'+offer.nextCapacity+'格，已支付'+offer.price+'金币，当前金币'+(state.gold-offer.price)+'（手机已结算，正文不再扣费，容量以当前基线为准）'};
}
export const capacityStateRule='【背包容量】容量是已解锁总格数，沿用当前已确认容量；正文实际升级时输出新的容量绝对值，未升级保持原值。手机扩容已扣费并解锁，正文只演绎结果，不重复扣金币。';
