export interface Point { x:number; y:number }
export interface Quad { topLeft:Point; topRight:Point; bottomRight:Point; bottomLeft:Point }
export type ScanMode='color'|'grayscale'|'black-white'|'original'
export interface ScanSettings { mode:ScanMode; brightness:number; contrast:number; threshold:number; sharpen:number; outputQuality:number }
export interface ScanPage { id:string; name:string; sourceUrl:string; width:number; height:number; quad:Quad; rotation:number; settings:ScanSettings }
