const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ZCREDIT_API_URL = 'https://pci.zcredit.co.il/WebCheckout/api/WebCheckout/CreateSession'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const ZCREDIT_KEY = Deno.env.get('ZCREDIT_KEY')
    if (!ZCREDIT_KEY) throw new Error('ZCREDIT_KEY not configured')

    const body = await req.json()
    const { total, items, customerName, customerPhone, orderId, successUrl, cancelUrl, callbackUrl } = body

    if (!total || !items || !successUrl || !cancelUrl || !callbackUrl) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Build cart items from order items for invoice
    const cartItems = items.map((item: any) => ({
      Amount: Number(item.price),
      Currency: 'ILS',
      Name: item.name,
      Description: item.description || item.name,
      Quantity: Number(item.quantity),
      IsTaxFree: false,
    }))

    const zcreditBody = {
      Key: ZCREDIT_KEY,
      Local: 'He',
      UniqueId: orderId || `order-${Date.now()}`,
      SuccessUrl: successUrl,
      CancelUrl: cancelUrl,
      CallbackUrl: callbackUrl,
      PaymentType: 'regular',
      CreateInvoice: true,
      ShowCart: true,
      ThemeColor: 'E85D2C',
      AdditionalText: `הזמנה עבור ${customerName || ''} ${customerPhone || ''}`,
      Customer: {
        Name: customerName || '',
        PhoneNumber: customerPhone || '',
        Email: '',
        Attributes: {
          HolderId: 'optional',
          Name: 'optional',
          PhoneNumber: 'optional',
          Email: 'optional',
        },
      },
      CartItems: cartItems,
      UseLightMode: false,
      BitButtonEnabled: true,
      ApplePayButtonEnabled: true,
      GooglePayButtonEnabled: true,
    }

    const response = await fetch(ZCREDIT_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(zcreditBody),
    })

    const result = await response.json()

    console.log('Z-Credit response:', JSON.stringify(result))

    if (result.HasError || result.Data?.HasError) {
      console.error('Z-Credit error:', JSON.stringify(result))
      return new Response(JSON.stringify({ 
        error: result.Errors?.[0]?.MessageHe || result.Data?.ReturnMessage || 'שגיאה ביצירת עמוד תשלום',
        details: result.Errors,
        data: result.Data,
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({
      sessionId: result.Data.SessionId,
      sessionUrl: result.Data.SessionUrl,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Payment error:', error)
    return new Response(JSON.stringify({ error: error.message || 'שגיאה בשרת' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
