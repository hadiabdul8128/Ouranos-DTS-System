import type {HotelProperty} from './hotel-discovery';

/** Reuse a matching or unassigned lodging row; never overwrite another named
 * hotel or disturb airfare and other budget entries. Repeated selection is safe. */
export function hotelPlanTarget(items:Array<{category:string;merchant:string}>,property:HotelProperty):number{
 const merchant=property[0].trim().toLocaleLowerCase('en-US');
 const matching=items.findIndex(item=>item.category==='lodging'&&item.merchant.trim().toLocaleLowerCase('en-US')===merchant);
 return matching>=0?matching:items.findIndex(item=>item.category==='lodging'&&!item.merchant.trim());
}
