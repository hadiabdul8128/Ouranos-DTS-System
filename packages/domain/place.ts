/** U.S. states and territories, so trips name a real, searchable place. */
export const STATES:Array<[string,string]>=[['AL','Alabama'],['AK','Alaska'],['AZ','Arizona'],['AR','Arkansas'],['CA','California'],['CO','Colorado'],['CT','Connecticut'],['DE','Delaware'],['DC','District of Columbia'],['FL','Florida'],['GA','Georgia'],['HI','Hawaii'],['ID','Idaho'],['IL','Illinois'],['IN','Indiana'],['IA','Iowa'],['KS','Kansas'],['KY','Kentucky'],['LA','Louisiana'],['ME','Maine'],['MD','Maryland'],['MA','Massachusetts'],['MI','Michigan'],['MN','Minnesota'],['MS','Mississippi'],['MO','Missouri'],['MT','Montana'],['NE','Nebraska'],['NV','Nevada'],['NH','New Hampshire'],['NJ','New Jersey'],['NM','New Mexico'],['NY','New York'],['NC','North Carolina'],['ND','North Dakota'],['OH','Ohio'],['OK','Oklahoma'],['OR','Oregon'],['PA','Pennsylvania'],['RI','Rhode Island'],['SC','South Carolina'],['SD','South Dakota'],['TN','Tennessee'],['TX','Texas'],['UT','Utah'],['VT','Vermont'],['VA','Virginia'],['WA','Washington'],['WV','West Virginia'],['WI','Wisconsin'],['WY','Wyoming'],['AS','American Samoa'],['GU','Guam'],['MP','Northern Mariana Islands'],['PR','Puerto Rico'],['VI','U.S. Virgin Islands']];
export const OVERSEAS='overseas';
const codes=new Set(STATES.map(([code])=>code));
const byName=new Map(STATES.map(([code,name])=>[name.toLowerCase(),code]));

/** Split a saved "City, ST" or "City, Country" place back into its parts. */
export function parsePlace(value:string){
 const match=/^(.*?),\s*([^,]+)$/.exec(value.trim());
 if(!match)return {city:value.trim(),region:'',country:''};
 const [,city,rest]=match,upper=rest!.trim().toUpperCase(),named=byName.get(rest!.trim().toLowerCase());
 if(codes.has(upper))return {city:city!.trim(),region:upper,country:''};
 if(named)return {city:city!.trim(),region:named,country:''};
 return {city:city!.trim(),region:OVERSEAS,country:rest!.trim()};
}
export function formatPlace(city:string,region:string,country:string){
 const place=city.trim(),where=region===OVERSEAS?country.trim():region;
 return place&&where?`${place}, ${where}`:'';
}

