

import PrismaModule from "@prisma-cms/prisma-module";

import PrismaProcessor from "@prisma-cms/prisma-processor";
import chalk from "chalk";

import Tx from 'ethereumjs-tx';


export class EthTransactionProcessor extends PrismaProcessor {

  constructor(props) {

    super(props);

    this.objectType = "EthTransaction";

  }


  async create(objectType, args, info) {

    const {
      web3,
      currentUser,
    } = this.ctx;

    let {
      data: {
        privateKey,
        type,
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

    let address;


    const ethAccount = await this.getUserEthAccount(currentUserId);


    if (!ethAccount) {
      return this.addError("Не был получен кошелек пользователя");
    }

    const {
      address: from,
    } = ethAccount;


    if (!from) {
      this.addFieldError("from", "Не был указан отправитель");
    }


    const account = web3.eth.accounts.privateKeyToAccount(privateKey);

    if (!account) {
      return this.addError("Приватный ключ не был дешифрован");
    }


    const {
      address: accountAddress,
    } = account;


    if (accountAddress.toLowerCase() !== from.toLowerCase()) {
      return this.addError("Аккаунт по приватному ключу и аккаунт пользователя не совпадают");
    }

    params.unshift(from);


    switch (type) {

      case "SendEth":

        address = await this.sendEth(args, currentUserId);
        break;

    }


    if (!this.hasErrors()) {

      if (!address) {
        return this.addError("Не был получен адрес транзакции");
      }


      args = {
        data: {
          ...data,
          address,
          type,
          CreatedBy: {
            connect: {
              id: currentUserId,
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
        params: {
          0: from,
          1: to,
          2: amount,
        },
        privateKey,
      },
    } = args;


    privateKey = new Buffer(privateKey.replace(/^0x/, ''), 'hex');


    if (this.hasErrors()) {
      return;
    }

    let value = web3.utils.toWei(String(amount).replace(",", "."), 'ether');
    value = web3.utils.toHex(value);

    let transactionCount = await web3.eth.getTransactionCount(from);

    var rawTx = {
      nonce: web3.utils.toHex(transactionCount),
      value,
      to,
      gasLimit: web3.utils.toHex(21000),
      gasPrice: web3.utils.toHex(3 * 10 ** 9),
    };


    var tx = new Tx(rawTx);
    tx.sign(privateKey);

    var serializedTx = tx.serialize();


    return new Promise((resolve, reject) => {

      // let confirmationCount = 0;
      // const minConfirmations = 3;

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