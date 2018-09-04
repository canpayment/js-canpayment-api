const axios= require("axios")
const qs= require("qs")
/** Canpay API Class */
class Canpay {
  /* URL where to request */

  /**
   * Constructor
   */
  constructor(){
    this.accessToken=""
    this.refreshToken=""
    this.baseUrl="https://api.canpayment.work/api"
    this.apiEndpoint="https://mona.insight.monaco-ex.org/insight-api-monacoin"
    
  }

  /**
   * Base request method
   * @param {string} method -  HTTP method
   * @param {string} path -  Relative path from baseUrl
   * @param {Object} body - Request body
   * @param {boolean} ignoreCredential=false - If true, it doesn't throw even without token.
   */
  async request(method,path,body,ignoreCredential=false){
    if (!ignoreCredential&&!this.accessToken) {
      throw new Error("Log in first.")
    }
    const result= await axios({
      method,
      url:path,
      baseURL:this.baseUrl,
      headers:{
        "Authorization":this.accessToken,
        "Content-Type":"application/json"
      },
      data:body
    })
    return result.data
  }
  /**
   * Log in
   * @param {string} email
   * @param {string} password
   * @returns {object} payload
   */
  async logIn(email,password){
    const result = await this.request("post","/users/login",{email,password},true)
    this.accessToken=result.jwt
    this.refreshToken=result.refreshToken
    return result.payload
  }

  /**
   * Create an account
   * @param {string} email
   * @param {string} screenName
   * @param {string} password
   * @returns {Object} payload
   */
  async register(email,screenName,password){
    const result = await this.request("post","/users/register",{email,password,screenName},true)
    this.accessToken=result.jwt
    this.refreshToken=result.refreshToken
    return result.payload
  }

  /**
   * renew access JWT
   */
  async renewToken(){
    const result = await this.request("post","/refresh_token",{token:this.refreshToken},true)
    this.accessToken=result.jwt
    this.refreshToken=result.refreshToken
    return true
  }
  /**
   * Get wallets (MONA,XRP,JPY,ZNY,ALIS etc.)
   * Caution: It contains the secret key of XRP.
   * @param {string} cur - retrieve all available wallets if omitted
   * @returns {Object[]} wallets
   */
  getWallet(cur){
    return this.request("get","/wallets/"+(cur||""),{})
  }
  /**
   * Create a wallet
   * @param {string} cur
   * @returns {Object} wallet
   */
  createWallet(cur){
    return this.request("post","/wallets/"+cur,{})
  }
  /**
   * Get an invoice
   * @param {string} id - ID of mongodb record
   */
  getInvoice(id){
    return this.request("get","/payments/"+id,{})
  }

  /**
   * Pay for an invoice
   * @param {string} id - ID of mongodb record
   */
  payInvoice(id){
    return this.request("post",`/payments/${id}/execute`,{})
  }
  /**
   * issue an invoice
   * @param {string} currency
   * @param {number} amount
   */
  issueInvoice({// original=generatPayment
    currency,amount // original amount=fee
  }){
    return this.request("post",`/payments`,{currency,fee:amount})
  }
  /**
   * Get history of paid invoice of yours.
   * @param {string} cur
   * @param {boolean} paidOnly
   * @param {boolean} lastId - mongodb ID
   * @returns {Object[]} wallets
   */
  getPaymentHistory(cur,paidOnly=false,lastId=""){
    let str=`/payments/history/${cur}?paidOnly=${paidOnly|0}`
    if(lastId){
      str+="&lastId="+lastId
    }
    return this.request("get",str,{})
  }
  /**
   * (WIP not tested yet) Get deposit history of MONA from insight API
   * @param {integer} from
   * @param {integer} to
   * @returns {Object[]} A list of transactions
   */
  async getMonacoinDepositHistoryFromInsight(from=0,to=30){
    const wallets=await this.getWallet("mona")
    const txs=await axios({
      url:this.apiEndpoint+"/addrs/txs",
      data:qs.stringify({
        noAsm:1,
        noScriptSig:1,
        noSpent:0,
        from,to,
        addrs:[wallets[0].address]
      }),
      method:"POST"})
    return txs
  }
  async getBitZenyDepositHistoryFromInsight(from=0,to=30){
    const wallets=await this.getWallet("zny")
    const txs=await axios({
      url:this.apiEndpoint+"/addrs/txs",
      data:qs.stringify({
        noAsm:1,
        noScriptSig:1,
        noSpent:0,
        from,to,
        addrs:[wallets[0].address]
      }),
      method:"POST"})
    return txs
  }
  /**
   * Send your fund
   * @param {string} currency
   * @param {number} amount
   * @param {string} to
   * @param {number} tag - ripple tag
   */
  async transfer({currency,tag,to,amount}){
    currency=currency.toLowerCase()
    if(!currency==="xrp"){
      throw new Error("Tag is required when remitting XRP")
    }
    const result =await this.request("post","/wallets/transfer_"+currency,{
      amount,
      to,
      tag
    })
    return result
  }
  /**
   * Get registered credit card information
   * @returns {object} creditcard
   */
  getCreditCard(){
    return this.request("get","/card_tokens",{})
  }
  /**
   * register credit card information
   * @param {number} number - creditcard number
   * @param {number} expiry.month - creditcard expiry month
   * @param {number} expiry.year - creditcard expiry full year
   * @param {number} cvc - creditcard cvc 
   * @returns {object} creditcard from stripe
   */
  registerCreditCard({
    number,expiry:{month,year},cvc
  }){
    return this.request("post","/card_tokens",{
      number,
      exp_month:month,
      exp_year:year,
      cvc
    })
  }
  /**
   * deposit japanese yen via credit card
   * @param {number} amount - amount of japanese yen
   * @param {string} stripeCardToken - token start with "tok_"
   */
  chargeJpyViaCreditCard(amount,stripeCardToken){
    return this.request("post","/wallets/charge_jpy",{
      amount,source:stripeCardToken
    })
  }
  /**
   * get bank account
   * todo: if it can store multiple account, replace account into accounts
   */
  getBankAccount(){ //
    return this.request("get","/bank_accounts",{})
  }
  /**
   * update bank account
   * todo: if it can store multiple account, replace account into accounts
   * Example:
   * {
   * "branchCode": "123",
   * "company": "みずほ銀行",
   * "companyCode": "0001",
   * "name": "山本カンタ",
   * "number": "1234567",
   * "type": "0"
   * }
   * 
   */
  updateBankAccount({
    branchCode,
    company,
    companyCode,
    name,
    number,
    type}){
    return this.request("put","/bank_accounts",{
      branchCode,
      company,
      companyCode,
      name,
      number,
      type
    })
  }
}
module.exports=Canpay
