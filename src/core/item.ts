import { $storeName, $scheme } from '../constant';

interface Scheme {
  [key: string]: any;
}

class Item {
  [$storeName]: string = null;
  [$scheme]: Scheme = null;
}

export default Item;
