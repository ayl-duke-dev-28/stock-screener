import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach as afterEachVitest, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { stocks } from './data/stocks'

describe('screener criteria controls', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('API not configured'))))
  afterEachVitest(() => vi.unstubAllGlobals())

  it('uses live drag sliders for every numeric investment criterion', () => {
    render(<App />)

    const sliders = screen.getAllByRole('slider')
    expect(sliders).toHaveLength(6)
    sliders.forEach((slider) => expect(slider).toHaveAttribute('step', '1'))
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()

    const revenueSlider = screen.getByRole('slider', { name: 'Min. revenue growth' })
    fireEvent.change(revenueSlider, { target: { value: '30' } })

    expect(revenueSlider).toHaveValue('30')
    expect(screen.getByRole('button', { name: 'Filters 1' })).toBeInTheDocument()
    expect(screen.getByText('2', { selector: '.result-count strong' })).toBeInTheDocument()
  })

  it('loads the full market and paginates large result sets without rendering thousands of rows', async () => {
    const fullMarket = Array.from({ length: 121 }, (_, index) => ({
      ...stocks[index % stocks.length],
      ticker: `T${String(index + 1).padStart(3, '0')}`,
      name: `Company ${index + 1}`,
    }))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      stocks: fullMarket, total: 121, source: 'Business Quant', updatedAt: new Date().toISOString(),
    }))))

    const { container } = render(<App />)

    await waitFor(() => expect(screen.getByText('121', { selector: '.result-count strong' })).toBeInTheDocument())
    expect(container.querySelectorAll('.table-row')).toHaveLength(50)
    expect(screen.getByText('Business Quant')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument()
  })
})
