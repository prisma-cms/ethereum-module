
import fs from "fs";

import chalk from "chalk";

import PrismaModule from "@prisma-cms/prisma-module";

import LogModule from "@prisma-cms/log-module";
import UserModule from "@prisma-cms/user-module";
import MailModule from "@prisma-cms/mail-module";

import EthModule from "./eth";
// import AccountModule from "./account";
import ContractSourceModule from "./contractSource";
import TransactionModule from "./transaction";

import MergeSchema from 'merge-graphql-schemas';

import path from 'path';

import ethUtil from 'ethereumjs-util';
import sigUtil from 'eth-sig-util';

// console.log("ethUtil", ethUtil);

const moduleURL = new URL(import.meta.url);

const __dirname = path.dirname(moduleURL.pathname);

const { createWriteStream, unlinkSync } = fs;

const { fileLoader, mergeTypes } = MergeSchema



class Module extends PrismaModule {


  constructor(props = {}) {

    super(props);

    Object.assign(this, {
    });

    this.mergeModules([
      LogModule,
      UserModule,
      MailModule,
      EthModule,
      // AccountModule,
      ContractSourceModule,
      TransactionModule,
    ]);

    this.Query = {
      ethBalance: this.ethBalance,
    }

    this.Mutation = {
      ethRecoverPersonalSignature: this.ethRecoverPersonalSignature,
    }

  }


  getSchema(types = []) {


    let schema = fileLoader(__dirname + '/schema/database/', {
      recursive: true,
    });


    if (schema) {
      types = types.concat(schema);
    }


    let typesArray = super.getSchema(types);

    return typesArray;

  }


  getApiSchema(types = []) {


    let baseSchema = [];

    let schemaFile = __dirname + "/../schema/generated/prisma.graphql";

    if (fs.existsSync(schemaFile)) {
      baseSchema = fs.readFileSync(schemaFile, "utf-8");
    }

    let apiSchema = super.getApiSchema(types.concat(baseSchema), [
      "EthContractSourceCreateInput",
      "EthContractSourceUpdateInput",
      "EthTransactionCreateInput",
    ]);

    let schema = fileLoader(__dirname + '/schema/api/', {
      recursive: true,
    });

    apiSchema = mergeTypes([apiSchema.concat(schema)], { all: true });


    return apiSchema;

  }


  getResolvers() {

    const resolvers = super.getResolvers();


    Object.assign(resolvers.Query, this.Query);

    Object.assign(resolvers.Mutation, this.Mutation);

    Object.assign(resolvers.Subscription, this.Subscription);


    Object.assign(resolvers, {
    });

    return resolvers;
  }


  async ethBalance(source, args, ctx, info) {

    let address;

    const {
      convert,
    } = args;

    if (source) {
      address = source.address;
    }
    else {
      address = args.address;
    }

    if (!address) {
      return null;
    }

    const {
      web3,
    } = ctx;


    let result;

    // console.log("ethBalance address", address);

    // return null;

    try {

      result = await web3.eth.getBalance(address)
        .then(balance => {

          // console.log("balance", balance, typeof balance);

          if (balance) {

            // switch (convert) {

            //   case 'ether':

            //     balance = web3.utils.fromWei(balance, 'ether');
            //     break;

            // }

            balance = web3.utils.fromWei(balance, convert);

          }

          return balance;

        })

    }
    catch (error) {

      console.error(chalk.red("Get balance error"), error);
    }



    // console.log("result", result);

    return result || null;
  }


  async ethRecoverPersonalSignature(source, args, ctx, info) {

    const {
      data: {
        message,
        signature,
        from,
      },
    } = args;


    // const message = "adsfdsfsdfdsf";
    // const signature = "0x5be35a35a643d96cb7502636355a7b8f2da46faedbc5418e5bd4ca357e05afa621f6d7e3ce0d5f61014a339462935f031a690fc95fe838086f9854907bd7cf731b";


    var msgBuffer = ethUtil.bufferToHex(new Buffer(message, 'utf8'))

    const msgParams = {
      data: msgBuffer,
      sig: signature,
    }


    // console.log("signature", signature);
    // console.log("msgBuffer", msgBuffer);

    // console.dir({ msgParams })
    const signedBy = sigUtil.recoverPersonalSignature(msgParams)
    // console.log("recovered", { signedBy });


    // const from = "0xf7b9bb273bf9c0ed5ed47d7d2f383fe2e08cde07";

    // console.log("from signedBy", signedBy, signedBy === from);

    let result;


    if (signedBy === from) {
      result = signedBy;
    }
    else {
      throw new Error ("Signed by not match");
    }

    return result;
  }


}


export default Module;