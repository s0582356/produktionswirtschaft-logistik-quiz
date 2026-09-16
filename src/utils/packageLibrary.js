import { isPackageBank, validatePackageBank } from './packageBankValidator.js'

export async function readPackageBankFiles(files) {
  const results = await Promise.all([...files].map(async (file, index) => {
    try {
      const parsed = JSON.parse(await file.text())
      if (!isPackageBank(parsed)) throw new Error('Keine Paketbank erkannt.')
      return { index, fileName: file.name, bank: validatePackageBank(parsed) }
    } catch (error) {
      return { index, fileName: file.name, error: error.message || 'Datei konnte nicht gelesen werden.' }
    }
  }))

  const banks = []
  const errors = []
  const duplicates = []
  const seen = new Set()
  results.sort((left, right) => left.index - right.index).forEach((result) => {
    if (result.error) {
      errors.push({ fileName: result.fileName, reason: result.error })
      return
    }
    if (seen.has(result.bank.packageId)) duplicates.push(result.bank.packageId)
    seen.add(result.bank.packageId)
    banks.push({ fileName: result.fileName, bank: result.bank })
  })

  return { banks, errors, duplicates: [...new Set(duplicates)] }
}

export function addPackageBanks(packageBanksById, importedBanks) {
  return importedBanks.reduce((library, { bank, fileName }) => ({
    ...library,
    [bank.packageId]: {
      ...bank,
      fileName,
    },
  }), { ...packageBanksById })
}
