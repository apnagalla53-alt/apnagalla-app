export type FootwearOptionsValue={sizes:string[];colours:string[];hasSizes:boolean;hasColours:boolean;different:boolean;prices:Record<string,string>};
export const emptyFootwearOptions:FootwearOptionsValue={sizes:[],colours:[],hasSizes:false,hasColours:false,different:false,prices:{}};
export function footwearCombinations(value:FootwearOptionsValue) {
 const sizes=value.hasSizes?value.sizes:[''],colours=value.hasColours?value.colours:[''];
 if(!value.hasSizes&&!value.hasColours)return [];
 return sizes.flatMap(Size=>colours.map(Colour=>({...Size&&{Size},...Colour&&{Colour}})));
}
export const variantOptionKey=(attributes:object)=>JSON.stringify(Object.entries(attributes).sort(([a],[b])=>a.localeCompare(b)));
