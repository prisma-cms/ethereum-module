
import Module from "./modules";


import EthAccountModule, {
  EthAccountProcessor,
} from "./modules/account";

export {
  EthAccountModule,
  EthAccountProcessor,
};


import EthPersonalAccountModule, {
  EthPersonalAccountProcessor,
} from "./modules/personalAccount";

export {
  EthPersonalAccountModule,
  EthPersonalAccountProcessor,
};


import EthBlockModule, {
  EthBlockProcessor,
} from "./modules/block";

export {
  EthBlockModule,
  EthBlockProcessor,
};


export const Modules = [
  EthAccountModule,
  EthPersonalAccountModule,
  EthBlockModule,
];

export default Module
