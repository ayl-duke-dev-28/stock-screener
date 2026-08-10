import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('screener criteria controls', () => {
  it('uses live drag sliders for every numeric investment criterion', () => {
    render(<App />)

    const sliders = screen.getAllByRole('slider')
    expect(sliders).toHaveLength(6)
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()

    const revenueSlider = screen.getByRole('slider', { name: 'Min. revenue growth' })
    fireEvent.change(revenueSlider, { target: { value: '30' } })

    expect(revenueSlider).toHaveValue('30')
    expect(screen.getByRole('button', { name: 'Filters 1' })).toBeInTheDocument()
    expect(screen.getByText('2', { selector: '.result-count strong' })).toBeInTheDocument()
  })
})
