

import PrismaModule from "@prisma-cms/prisma-module";

import PrismaProcessor from "@prisma-cms/prisma-processor";
import chalk from "chalk";

import Tx from 'ethereumjs-tx';
import solc from 'solc';


export class EthTransactionProcessor extends PrismaProcessor {

  constructor(props) {

    super(props);

    this.objectType = "EthTransaction";

  }


  async create(objectType, args, info) {

    const {
      db,
      web3,
      currentUser,
    } = this.ctx;

    let {
      data: {
        to,
        contractSourceId,
        privateKey,
        type,
        gasPrice,
        params = [],
        ...data
      },
      ...otherArgs
    } = args;

    const {
      id: currentUserId,
    } = currentUser || {};


    if (!currentUserId) {
      return this.addError("Необходимо авторизоваться");
    }

    const chainId = await web3.eth.net.getId();

    let address;


    const ethAccount = await this.getUserEthAccount(currentUserId);


    if (!ethAccount) {
      return this.addError("Не был получен кошелек пользователя");
    }

    const {
      id: senderAccountId,
      address: from,
    } = ethAccount;


    if (!from) {
      this.addFieldError("from", "Не был указан отправитель");
    }


    let account;

    if (!privateKey) {
      return this.addFieldError("privateKey", "Не был указан приватный ключ");
    }
    else if (!/^0x/.test(privateKey)) {
      return this.addFieldError("privateKey", "Приватный ключ должен начинаться с 0x");
    }

    try {
      account = web3.eth.accounts.privateKeyToAccount(privateKey);
    }
    catch (error) {
      console.error(chalk.red("privateKeyToAccount Error"), error);
    }


    if (!account) {
      return this.addFieldError("privateKey", "Приватный ключ не был дешифрован");
    }


    const {
      address: accountAddress,
    } = account;


    if (accountAddress.toLowerCase() !== from.toLowerCase()) {
      return this.addError("Аккаунт по приватному ключу и аккаунт пользователя не совпадают");
    }



    let Receiver;

    if (to) {

      if (to === from) {
        return this.addError("Нельзя отправлять транзакции самому же себе");
      }

      const ReceiverAccount = await db.query.ethAccount({
        where: {
          address: to,
        },
      });

      if (!ReceiverAccount) {
        return this.addError("Не был найден получатель");
      }


      const {
        id: receiverAccountId,
        address: receiverAddress,
      } = ReceiverAccount;


      // params.unshift(receiverAddress);
      Object.assign(args.data, {
        to: receiverAddress,
      });

      Receiver = {
        connect: {
          id: receiverAccountId,
        },
      }

    }


    // params.unshift(from);


    switch (type) {

      case "SendEth":

        address = await this.sendEth(args, currentUserId);
        break;

      case "ContractCreate":

        address = await this.createContract(args, currentUser, data);
        break;

    }


    if (!this.hasErrors()) {

      if (!address) {
        return this.addError("Не был получен адрес транзакции");
      }


      args = {
        data: {
          ...data,
          Receiver,
          chainId,
          address,
          type,
          // CreatedBy: {
          //   connect: {
          //     id: currentUserId,
          //   },
          // },
          Sender: {
            connect: {
              id: senderAccountId,
            },
          },
        },
        ...otherArgs,
      }

      return super.create(objectType, args, info);

    }

    return;

  }


  async mutate(method, args, info) {


    return super.mutate(method, args);
  }


  async getUserEthAccount(userId) {

    const {
      db,
    } = this.ctx;

    const ethAccounts = await db.query.ethAccounts({
      first: 1,
      where: {
        CreatedBy: {
          id: userId,
        },
      },
    });

    return ethAccounts && ethAccounts[0] || null;
  }


  async sendEth(args, currentUserId) {

    const {
      web3,
    } = this.ctx;

    let {
      data: {
        to,
        gasPrice = 3,
        amount,
        params,
        privateKey,
      },
    } = args;

    if (!to) {
      return this.addError("Не был указан получатель");
    }

    if (!amount) {
      return this.addFieldError("amount", "Не указана сумма перевода");
    }
    else if (amount < 0) {
      return this.addFieldError("amount", "Сумма перевода не может быть отрицательной");
    }

    // const {
    //   0: from,
    //   1: to,
    //   // 2: amount, 
    // } = params;

    let value = web3.utils.toWei(String(amount).replace(",", "."), 'ether');
    value = web3.utils.toHex(value);

    var rawTx = {
      value,
      to,
      gasPrice: web3.utils.toHex(gasPrice * 10 ** 9),
    };

    return this.sendTransaction(rawTx, privateKey);
  }


  async createContract(args, currentUser, data) {

    const {
      id: currentUserId,
      email,
    } = currentUser;

    let {
      data: {
        params,
        privateKey,
        contractSourceId,
        gasPrice = 3,
      },
    } = args;


    if (!contractSourceId) {
      return this.addError("Не был указан ID кода контракта");
    }


    const {
      db,
      web3,
    } = this.ctx;


    const chainId = await web3.eth.net.getId();


    const contractSource = await this.query("ethContractSource", {
      where: {
        id: contractSourceId,
      },
    }, `{
      id
      name
      source
      CreatedBy{
        id
      }
    }`);

    const {
      name,
      source,
      CreatedBy: {
        id: createdById,
      },
    } = contractSource;


    // Контракт, который должен быть в результате создан
    let Account;


    // console.log("contractSource", contractSource);

    // return;


    // if (!createdById || createdById !== currentUserId) {
    //   this.addError("Нельзя деплоить чужой контракт");
    // }

    // else if (!from) {
    //   this.addError("Не был получен кошелек пользователя");
    // }

    // else 
    if (!source) {
      this.addError("Не был получен исходный код контракта");
    }

    // else if (!password) {
    //   this.addFieldError("password", "Не указан пароль для кошелька");
    // }

    else {


      let contractSourcesSource;


      try {
        contractSourcesSource = solc.compile(source);
      }
      catch (error) {


        throw (error);
      }


      // console.log("contractSourcesSource", contractSourcesSource);

      let contractSources = [];

      if (contractSourcesSource) {

        const {
          errors,
          contracts,
        } = contractSourcesSource;

        if (errors && errors.length) {
          // throw new Error(errors);
          console.error(chalk.cyan("Compele errors"), errors);
        }

        // for (var contractSourceName in contractSourcesSource.contractSources) {
        for (var contractSourceName in contracts) {

          // const contractSource = contractSourcesSource.contractSources[contractSourceName];
          const contractSource = contracts[contractSourceName];

          let {
            interface: contractSourceInterface,
          } = contractSource;

          if (contractSourceInterface) {

            try {

              contractSourceInterface = JSON.parse(contractSourceInterface);

            }
            catch (e) {
              console.error("Compele contract error", e);
              throw (e);
            }

          }

          // code and ABI that are needed by web3


          // console.log("contractSources name", contractSourceName.replace(/^:*/, ''), name);


          contractSources.push({
            ...contractSource,
            name: contractSourceName.replace(/^:*/, ''),
            abi: contractSourceInterface,
          });

        }
      }
      else {
        throw new Error("Не удалось скомпиллировать контракт");
      }

      // console.log("contractSources", contractSources);

      let contractSourceForDeploy = contractSources.find(n => n.name === name);






      // return;

      if (!contractSourceForDeploy) {
        this.addFieldError("name", "Не был получен публикуемый контракт");
      }
      else {

        /**
         * Если скомпиллированный контракт был получен,
         * отправляем транзакцию,
         * а исходники контракта добавляем к аккаунту
         */

        const {
          abi,
          bytecode,
        } = contractSourceForDeploy;


        Account = {
          name,
          chainId,
          abi,
          bytecode,
          source,
          type: "Contract",
          ContractSource: {
            connect: {
              id: contractSourceId,
            },
          },
          CreatedBy: {
            connect: {
              id: currentUserId,
            },
          },
        };


        // await this.ethDeployContractSource({
        //   abi,
        //   bytecode,
        //   from,
        //   password,
        // })
        //   .then(deployResult => {



        //     const {
        //       newContractSourceInstance,
        //       txHash,
        //     } = deployResult;




        //     const {
        //       _jsonInterface,
        //       _address,
        //     } = newContractSourceInstance;

        //     Object.assign(data, {
        //       Deployed: {
        //         create: {
        //           name,
        //           source,
        //           address: _address,
        //           txHash,
        //           bytecode,
        //           abi: _jsonInterface,
        //           CreatedBy: {
        //             connect: {
        //               id: currentUserId,
        //             },
        //           },
        //         },
        //       },
        //     });

        //   });


      }

    }


    // args = {
    //   where,
    //   data: {
    //     ...data
    //   },
    //   ...otherArgs
    // };

    // return this.sendTransaction(params, privateKey);

    if (!Account) {
      return this.addError("Не был сформирован аккаунт");
    }

    const {
      abi,
      bytecode,
    } = Account;


    // const {
    //   address: contractAddress,
    //   privateKey: contractPrivateKey,
    // } = web3.eth.accounts.create(web3.utils.randomHex(32));;

    // console.log("contract", contractAddress);


    var contract = new web3.eth.Contract(abi);

    // var contract = new web3.eth.Contract(abi, null, {
    //   address: contractAddress,
    // });

    // contract.options.address = contractAddress;

    // console.log("contract", contract.options);
    // console.log("contract.address", contract.options.address);


    // return;

    let deploy = contract.deploy({
      /**
       * Если не передать hex, то будет ругаться, что не хватает газа
       */
      data: /^0x/.test(bytecode) ? bytecode : `0x${bytecode}`,
      arguments: []
    });

    // console.log("contract deploy", deploy);

    // return;

    const address = await this.sendTransaction({
      data: deploy.encodeABI(),
      gasLimit: web3.utils.toHex(3000000),
      gasPrice: web3.utils.toHex(gasPrice * 10 ** 9),

      // Call contract method
      // to: contract.options.address,
      // toCreationAddress: true,
    }, privateKey);

    // console.log("contract address", address);


    // const result = contract.deploy({
    //   data: `0x${bytecode}`,
    //   arguments: [],
    // })

    // console.log("contract result", result);


    // return;


    // let rawTx = {}


    // console.log("rawTx", rawTx);

    // return;

    // // const address = await this.sendTransaction(params, privateKey);
    // const address = await this.sendTransaction(rawTx, privateKey);

    if (address) {



      const txData = await web3.eth.getTransactionReceipt(address);

      // console.log("txData", txData);

      if (txData) {

        const {
          contractAddress,
          status,
        } = txData;

        Object.assign(Account, {
          address: contractAddress,
        });


        Object.assign(data, {
          Account: {
            create: Account,
          },
        });

        // await db.mutation.createLetter({
        //   data: {
        //     rank: 100,
        //     email,
        //     subject: "Данные вашего контракта",
        //     message: `
        //     <h3>
        //       Данные вашего контракта
        //     </h3>

        //     <p>
        //       <strong>Адрес:</strong> ${contractAddress}
        //     </p>

        //     <p>
        //       <strong>Приватный ключ:</strong> ${contractPrivateKey}
        //     </p>
        //   `,
        //   }
        // });

      }


    }

    return address;
  }


  async sendTransaction(rawTx, privateKey) {

    const {
      web3,
    } = this.ctx;


    if (this.hasErrors()) {
      return;
    }

    const {
      address: from,
    } = web3.eth.accounts.privateKeyToAccount(privateKey);


    let transactionCount = await web3.eth.getTransactionCount(from);


    rawTx = {
      nonce: web3.utils.toHex(transactionCount),
      gasLimit: web3.utils.toHex(210000),
      gasPrice: web3.utils.toHex(4 * 10 ** 9),
      ...rawTx,
    };

    privateKey = new Buffer(privateKey.replace(/^0x/, ''), 'hex');

    var tx = new Tx(rawTx);
    tx.sign(privateKey);

    var serializedTx = tx.serialize();


    return new Promise((resolve, reject) => {

      let transactionHash;

      web3.eth.sendSignedTransaction("0x" + serializedTx.toString('hex'), (error, txHash) => {
        console.log(chalk.green("sendSignedTransaction error, txHash"), error, txHash);

        if (error) {
          reject(error);
          return;
        }
        // else  
        transactionHash = txHash;
        resolve(txHash);
      })
        .on('confirmation', (confirmationNumber, receipt) => {
          console.log(chalk.green('confirmation'), confirmationNumber);

          // confirmationCount++;

          // if (minConfirmations === confirmationCount) {
          //   return resolve(transactionHash);
          // }

        })
        .on('error', reject)

      /**
       * Error: Failed to check for transaction receipt
       * if use this
       */
      // .then(function (receipt) {
      //   console.log("sendSignedTransaction then receipt");
      //   return ;
      // });

    });

  }


}


class AccountModule extends PrismaModule {


  constructor(props = {}) {

    super(props);

    this.Query = {
      ethTransaction: this.ethTransaction,
      ethTransactions: this.ethTransactions,
      ethTransactionsConnection: this.ethTransactionsConnection,
    };

    this.Mutation = {
      createEthTransactionProcessor: this.createEthTransactionProcessor.bind(this),
    }


    this.Subscription = {
      ethTransaction: {
        subscribe: async (parent, args, ctx, info) => {

          return ctx.db.subscription.ethTransaction({}, info);
        },
      },
    }


    this.EthTransactionResponse = {
      data: (source, args, ctx, info) => {

        const {
          id,
        } = source.data || {};

        return id ? ctx.db.query.ethTransaction({
          where: {
            id,
          },
        }, info) : null;
      }
    }

  };



  getProcessor(ctx) {
    return new (this.getProcessorClass())(ctx);
  }


  getProcessorClass() {
    return EthTransactionProcessor;
  }


  createEthTransactionProcessor(source, args, ctx, info) {

    return this.getProcessor(ctx).createWithResponse("EthTransaction", args, info);
  }


  ethTransaction(source, args, ctx, info) {

    return ctx.db.query.ethTransaction(args, info);
  }


  ethTransactions(source, args, ctx, info) {

    return ctx.db.query.ethTransactions(args, info);
  }


  ethTransactionsConnection(source, args, ctx, info) {

    return ctx.db.query.ethTransactionsConnection(args, info);
  }




  getResolvers() {

    const resolvers = super.getResolvers();


    Object.assign(resolvers.Query, this.Query);

    Object.assign(resolvers.Mutation, this.Mutation);

    Object.assign(resolvers.Subscription, this.Subscription);


    Object.assign(resolvers, {
      EthTransactionResponse: this.EthTransactionResponse,
    });

    return resolvers;
  }

}

export default AccountModule;