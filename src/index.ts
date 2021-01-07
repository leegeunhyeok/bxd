import BoxDB from './core/box';
import BoxItem from './core/item';

export default BoxDB;
export const Item = BoxItem;

const Box = new BoxDB('my-db', 2);
Box.create();
