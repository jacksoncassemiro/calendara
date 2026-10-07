/** Keep a date span in one lane, allowing disjoint spans to reuse that lane. */
export function packDateSpans<T extends {start:number;span:number}>(segments: readonly T[]): (T & {lane:number})[] {
  const occupied: boolean[][] = [];
  return segments.map(segment => {
    let lane = occupied.findIndex(row => Array.from({length:segment.span},(_,index)=>segment.start+index).every(index=>!row[index]));
    if (lane < 0) { lane=occupied.length; occupied.push([]); }
    for(let index=segment.start;index<segment.start+segment.span;index++) occupied[lane]![index]=true;
    return {...segment,lane};
  });
}
