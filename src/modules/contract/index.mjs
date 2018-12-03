
import PrismaModule from "@prisma-cms/prisma-module";

const ethContract = async function (source, args, ctx, info) {


  const {
    name,
  } = args;

  const result = await ethContracts(source, args, ctx);


  return result ? result.find(n => n.name === name) : null;
}

const ethContracts = async function (source, args, ctx, info) {

  const {
    contractsSource,
  } = ctx;

  let contracts = [];


  if (contractsSource) {

    for (var contractName in contractsSource.contracts) {

      const contract = contractsSource.contracts[contractName];

      let {
        interface: contractInterface,
      } = contract;

      if (contractInterface) {

        try {

          contractInterface = JSON.parse(contractInterface);

        }
        catch (e) {
          console.error
        }

      }

      contracts.push({
        ...contract,
        name: contractName.replace(/^:*/, ''),
        interface: contractInterface,
      });

    }
  }

  return contracts;
}


const ethDeployContract = async function (source, args, ctx, info) {

  const {
    web3,
  } = ctx;

  let {
    params,
    from,
    password,
    gas = 3000000,
    gasPrice = 10**9,
  } = args;

  // Если не указано от кого, выполняет от базового аккаунта
  if(!from){
    
    const coinbase = await web3.eth.getCoinbase()
    .then(r => r)
    .catch(e => {
      throw(e);
    });
  
    if(!coinbase){
      throw(new Error("Can not get coinbase"));
    }

    from = coinbase;
  }


  const contractSource = await contract(source, args, ctx).then(r => r).catch(e => {
    throw (e);
  });

  if (!contractSource) {
    throw ("Can not get contract");
  }

  const {
    interface: contractInterface,
    bytecode,
  } = contractSource;


  var myContract = new web3.eth.Contract(contractInterface);

  // console.log("params", params);
  // console.log("bytecode", bytecode);


  if(password){
    const unlockResult = await web3.eth.personal.unlockAccount(from, password)
    .catch(e => {
      throw(e);
    });
  }

  return new Promise((resolve, reject) => {

    const data = `0x${bytecode}`;

    myContract.deploy({
      data,
      arguments: params,
    })
      .send({
        from,
        gas,
        gasPrice,
      }, function (error, transactionHash) {
        console.log("send transactionHash", transactionHash);
      })
      .on('error', function (error) {
        console.log("error", error);

        reject(error);

      })
      .on('transactionHash', function (transactionHash) {
        console.log("on transactionHash", transactionHash);
      })
      .on('receipt', function (receipt) {
        console.log("on receipt", receipt.contractAddress) // contains the new contract address
      })
      .on('confirmation', function (confirmationNumber, receipt) {
        // console.log("on confirmation", confirmationNumber, receipt);
      })
      .then(function (newContractInstance) {
        // console.log("newContractInstance", newContractInstance.options.address) // instance with the new contract address
        console.log("newContractInstance", newContractInstance) // instance with the new contract address

        resolve(newContractInstance);
      });
      
    console.log("myContract", myContract);

  });

}

const ethContractByAddress = async function (source, args, ctx, info) {

  const {
    web3,
  } = ctx;


  const {
    address,
  } = args;


  const contractSource = await contract(source, args, ctx).then(r => r).catch(e => {
    throw (e);
  });

  if (!contractSource) {
    throw ("Can not get contract");
  }

  const {
    interface: contractInterface,
    bytecode,
  } = contractSource;


  var myContract = new web3.eth.Contract(contractInterface);


  return new Promise((resolve, reject) => {

    
    myContract.options.address = address;

    console.log("myContract", myContract);

    resolve(myContract);

  });

}


const callContractMethod = async function(contractMethod, source, args, ctx, info){

  console.log("callContractMethod args", args);

  let {
    method,
    params,
    from,
  } = args;

  const {
    web3,
  } = ctx;

  const contract = await ethContractByAddress(source, args, ctx);

  if(!contract){
    throw(new Error("Can not get contract"));
  }

  
  if(!from){

    const coinbase = await web3.eth.getCoinbase()
    .then(r => r)
    .catch(e => {
      throw(e);
    });
  
    if(!coinbase){
      throw(new Error("Can not get coinbase"));
    }
    ;

    from = coinbase;
  }

  const {
    methods,
  } = contract;

  if(!methods || !methods[method]){
    throw(new Error("Can not get method"));
  }

  const result = await methods[method].apply(this, params)[contractMethod]({
    from,
    gas: 3000000,
  })
  .then(r => r)
  .catch(error => {
    throw(error);
  });

  console.log("call result", result);

  return result;
}


const mint = async function(source, args, ctx, info){

  const {
    masterPassword,
    to,
    amount,
    ...other
  } = args;

  const {
    web3,
  } = ctx;



  const coinbase = await web3.eth.getCoinbase()
  .then(r => r)
  .catch(e => {
    throw(e);
  });

  if(!coinbase){
    throw(new Error("Can not get coinbase"));
  }


  const unlockResult = await web3.eth.personal.unlockAccount(coinbase, masterPassword)
  .catch(e => {
    throw(e);
  });


  console.log("unlockResult", unlockResult);

    
  const result = await ethContractRead(source, {
    ...other,
    method: "mint",
    params: [to, amount],
  }, ctx, info);

  console.log("call result", result);

  return result;
}


const ethChargeUserBalance = async function(source, args, ctx, info){

  const {
    masterPassword,
    to,
    amount,
    ...other
  } = args;

  const {
    web3,
  } = ctx;



  const coinbase = await web3.eth.getCoinbase()
  .then(r => r)
  .catch(e => {
    throw(e);
  });

  if(!coinbase){
    throw(new Error("Can not get coinbase"));
  }


  const unlockResult = await web3.eth.personal.unlockAccount(coinbase, masterPassword)
  .catch(e => {
    throw(e);
  });


  console.log("unlockResult", unlockResult);

    
  const result = await ethContractRead(source, {
    ...other,
    method: "ethChargeUserBalance",
    params: [to, amount],
  }, ctx, info);

  console.log("ethChargeUserBalance result", result);

  return result;
}

const ethContractCall = async function(source, args, ctx, info){
 
  return callContractMethod("call", source, args, ctx, info);
}

const ethContractRead = async function(source, args, ctx, info){
 
  return callContractMethod("send", source, args, ctx, info);
}

 



class ContractModule extends PrismaModule {


  constructor(props = {}) {

    super(props);

    Object.assign(this, {
      Query: {
        ethContract,
        ethContracts,
        ethContractByAddress,
      },
      Mutation: {
        ethDeployContract,
        ethContractCall,
        ethContractRead,
        // mint,
        ethChargeUserBalance,
      },
    });

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
  
}

export default ContractModule;
