import { ElfBinary, Pointer, type DataDivision } from "./elfBinary";
import { DataType } from "./dataType";
import { FILE_TYPES } from "./fileTypes";
import type { Instance } from "./fileTypes";
import { BinaryReader, Vector3 } from "./misc";
import { Relocation, Section, Symbol } from "./types";
import { ValueUuid, VALUE_UUID, DATA_TYPE, type UuidTagged, ValueUuids } from "./valueIdentifier";
import { peekable, type Peekable } from "./util";
import { demangle } from "./nameMangling";

export class EmptyFileError extends Error {
	constructor(message: any) {
		super(message)
		this.name = "EmptyFileError"
	}
}

export default function parseElfBinary(dataType: DataType, arrayBuffer: ArrayBuffer): ElfBinary {
	const view = new DataView(arrayBuffer)
	const reader = new BinaryReader(view)
	
	// In order to parse the contents of the ELF file, we need to understand the file structure
	// it is like this: Header, Sections..., Section Header Table (metadata about sections)
	// there are also sectors but those are for executables only, so we can ignore them
	
	// all of the content of the file is in the sections, so we need to parse them first
	
	
	// parse sections
	const sectionHeaderTableOffset = view.getBigInt64(0x28, true)
	const sectionAmount = view.getInt16(0x3c, true)
	
	reader.position = Number(sectionHeaderTableOffset)
	
	let sections: Section[] = []
	
	for (let i = 0; i < sectionAmount; i++) {
		let section = new Section(reader)
		section.content = arrayBuffer.slice(section.offset, section.offset + section.size)
		section.reader = new BinaryReader(section.content)
		sections.push(section)
	}
	
	// since TTYDR, the ELF related strings are split into .shstrtab and .strtab
	// .shstrtab contains all of the section names while .strtab contains everything
	// else (symbol names)
	// .shstrtab is referenced in the last field of the ELF header, while .strtab
	// can be identified by its name because .shstrtab will already be loaded
	const shStringSectionIndex = view.getInt16(0x3e, true)
	const shStringSection = sections[shStringSectionIndex]
	
	for (const section of sections) {
		section.name = shStringSection.getStringAt(section.namePointer)
	}
	
	const symStringSection = sections.find(section => section.name == ".strtab")
	
	// in order to parse the content, we have to parse the relocations as well
	// whenever in the data there is pointer, it is replaced with just zero and instead, a relocation entry is made
	// the relocation describes where the pointer should be stored in and where it points to (the section and offset)
	// because the section it points to is very predictable, we can read the offset and store it in the original location of the pointer
	
	let allRelocations = new Map<string, Map<number, Relocation>>()
	let allRelocationIters = new Map<string, Peekable<[number, Relocation]>>()
	
	// find all sections that start with ".rela" (e.g. '.rela.data') because those contain the relocations
	for (const section of sections) {
		
		if (section.name.startsWith(".rela")) {
			let reader = new BinaryReader(section.content)
			let relocations: Map<number, Relocation> = new Map()
			let prevOffset = -1
			
			while (reader.position < section.content.byteLength) {
				let relocation = Relocation.fromBinaryReader(reader)
				
				// Usually, the relocation table is in sequential order based on the offsets
				// the relocations are applied at. This is necessary later because it allows
				// better optimizations while parsing.
				if (prevOffset >= relocation.locationOffset.value) {
					throw new Error(`Relocation table ${section.name} not in sequential order`)
				}
				
				relocations.set(relocation.locationOffset.value, relocation)
				prevOffset = relocation.locationOffset.value
			}
			
			const originalSectionName = section.name.slice(".rela".length)
			allRelocations.set(originalSectionName, relocations)
			allRelocationIters.set(originalSectionName, peekable(relocations))
		}
	}
	
	
	// even though the relocation table makes constant references to the symbol table through the 'info' field,
	// we actually don't need to know the symbol table content to understand the relocations.
	// the info field is very predictable and usually just one constant throughout the entire relocation table
	
	// however, there are certain file types (maplink and data_npc_model, among others) that require the symbol table
	// because they contain multiple data types in the same file, whose placement is indicated by the symbol table
	
	const symTab = sections.find(section => section.name == ".symtab")
	let symbolTable: Symbol[] = []
	let symTabReader = new BinaryReader(symTab.content)
	
	while (symTabReader.position < symTab.content.byteLength) {
		let symbol = Symbol.fromBinaryWriter(symTabReader, symStringSection)
		symbolTable.push(symbol)
	}
	
	
	
	if (sections.filter(section => section.name == '.data').length === 0) {
		throw new EmptyFileError("The file is empty. Open a different one instead and clear out its contents")
	}
	
	// for most of the file formats, the data is stored in the .data section
	// as an array of structs. However, for some file formats (like maplink and data_npc_model),
	// there are multiple file formats
	
	let data: { [division in DataDivision]?: any[] }

	// Parses the .rodata section from a data_x_model file, since these are always the same and can be reused
	interface RawModelInstance {
		id: string
		assetGroups: Pointer
		assetGroupCount: number
		states: Pointer
		stateCount: number
	}
	

	function parseModelRodata(datas: {[division in DataDivision]?: any[]},models: RawModelInstance[]) {
		const rodataSection = findSection('.rodata')
		const stringSection = findSection('.rodata.str1.1')
		
		// TODO: this could be significantly cleaned up with symbolAddr

		// asset groups
		let allAssetGroups = []

		let model: ModelInstance[]
		
		for (const model of models) {
			const { assetGroups: offset, assetGroupCount } = model
			
			if (offset == undefined || offset == Pointer.NULL) {
				model.assetGroups = null
				continue
			}
			
			let children = applyStrings(
				offset, DataType.ModelAssetGroup, stringSection, 
				allRelocations.get('.rodata'), symbolTable,
				
				parseRawDataSection(rodataSection, assetGroupCount, offset, DataType.ModelAssetGroup), 
			)
			
			let symbol = findSymbolAt(rodataSection, offset) ?? createMissingSymbol(`wld::fld::data::^${model.id}_model_files`, rodataSection)
			
			let assetGroupObj = {
				symbolName: demangle(symbol.name),
				children,
			}
			
			allAssetGroups.push(assetGroupObj);
			(model as unknown as ModelInstance).assetGroups = assetGroupObj
		}
		
		data.assetGroup = allAssetGroups = []
		
		// states
		let allStates = []
		let allFaceGroups = []
		let allFaces = []
		let allAnimations = []
		
		for (const model of models) {
			const { states: offset, stateCount } = model
			
			if (offset == undefined || offset == Pointer.NULL) {
				model.states = null
				continue
			}
			
			let states = applyStrings(
				offset, DataType.ModelState, stringSection, 
				allRelocations.get('.rodata'), symbolTable,
				
				parseRawDataSection(rodataSection, stateCount, offset, DataType.ModelState), 
			)
			
			let symbol = findSymbolAt(rodataSection, offset) ?? createMissingSymbol(`wld::fld::data::^${model.id}_state`, rodataSection)
			
			let stateObj = {
				symbolName: demangle(symbol.name),
				children: states,
			}
			
			allStates.push(stateObj);
			(model as unknown as ModelInstance).states = stateObj
			
			// faceGroups
			for (const state of states) {
				const { substates: offset, substateCount } = state
				
				if (offset == undefined || offset == Pointer.NULL) {
					state.substates = null
					continue
				}
				
				let faceGroups = applyStrings(
					offset, DataType.ModelFaceGroup, stringSection, 
					allRelocations.get('.rodata'), symbolTable,
					
					parseRawDataSection(rodataSection, substateCount, offset, DataType.ModelFaceGroup), 
				)
				
				let symbol = findSymbolAt(rodataSection, offset) ?? createMissingSymbol(`wld::fld::data::^${model.id}_${Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)}`, rodataSection)
				
				let faceGroupObj = {
					symbolName: demangle(symbol.name),
					children: faceGroups,
				}
				
				allFaceGroups.push(faceGroupObj);
				state.substates = faceGroupObj
				
				// faces
				for (const faceGroup of faceGroups) {
					const { faces: offset, faceCount } = faceGroup
					
					if (offset == undefined || offset == Pointer.NULL) {
						faceGroup.faces = null
						continue
					}
					
					let faces = applyStrings(
						offset, DataType.ModelFace, stringSection, 
						allRelocations.get('.rodata'), symbolTable,
						
						parseRawDataSection(rodataSection, faceCount, offset, DataType.ModelFace), 
					)
					
					let symbol = findSymbolAt(rodataSection, offset)
						?? createMissingSymbol(`wld::fld::data::^${model.id}_${Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)}`, rodataSection)
					
					let faceObj = {
						symbolName: demangle(symbol.name),
						children: faces,
					}
					
					allFaces.push(faceObj);
					faceGroup.faces = faceObj
					
					// animations
					for (const face of faces) {
						const { animations: offset, animationCount } = face
						
						if (offset == undefined || offset == Pointer.NULL) {
							face.animations = null
							continue
						}
						
						let animations = applyStrings(
							offset, DataType.ModelAnimation, stringSection, 
							allRelocations.get('.rodata'), symbolTable,
							
							parseRawDataSection(rodataSection, animationCount, offset, DataType.ModelAnimation), 
						)
						
						let symbol = findSymbolAt(rodataSection, offset)
							?? createMissingSymbol(`wld::fld::data::^${model.id}_${Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)}`, rodataSection)
					
						let animationObj = {
							symbolName: demangle(symbol.name),
							children: animations,
						}
						
						allAnimations.push(animationObj);
						face.animations = animationObj
					}
				}
			}
		}
		
		data.anime = allAnimations
		data.face = allFaces
		data.subState = allFaceGroups
		data.state = allStates
	}

	function findSection(sectionName: string): Section {
		return sections.find(section => section.name == sectionName)
	}
	
	function findSymbol(name: string): Symbol {
		return symbolTable.find(symbol => symbol.name === name)
	}
	
	function findSymbolAt(section: Section, location: Pointer) {
		return symbolTable.find(symbol => symbol.location.equals(location) && sections[symbol.sectionHeaderIndex] == section && symbol.info != 0)
	}
	
	function createMissingSymbol(name: string, section: Section): Symbol {
		let symbol = new Symbol()
		
		// TODO: these values are only verified to be correct for data_btl's models
		symbol.name = name
		symbol.sectionHeaderIndex = sections.indexOf(section)
		symbol.info = 1
		symbol.visibility = 0
		
		// will be overwritten in serializer
		symbol.location = Pointer.NULL
		symbol.size = 0
		
		console.error(`Found missing symbol ${name}, created symbol`, symbol)
		
		symbolTable.push(symbol)
		return symbol
	}
	
	// parse data according to data type
	switch (dataType) {
		case DataType.None:
			data = null
			break

		case DataType.ItemList: {
			const dataSection = findSection('.data')
			const stringSection = findSection('.rodata.str1.1')
			
			// use special relocations for main table because it's at the end of file
			let tableRelocs = peekable(allRelocations.get(".data"))
			
			let mainSymbol = findSymbol("wld::btl::data::s_Data")
			let itemTables = parseSymbol(dataSection, stringSection, mainSymbol, DataType.ItemList, { count: -1, relocations: tableRelocs })

			debugger
			
			for (const table of itemTables) {
				const { items: symbolName } = table
				
				if (symbolName == undefined)
					continue
				
				let symbol = findSymbol(symbolName)
				let children = parseSymbol(dataSection, stringSection, symbol, DataType.ListItem, { count: -1 })
				
				let items = {
					symbolName,
					children,
				}
				
				table.items = items
			}
			
			// idea to abstract loop ^^^ away:
			// applyChildren(dataSection, stringSection, itemTables, [
			// 	items: {
			// 		dataType: DataType.ListItem,
			// 		count: -1,
			// 	},
			// ])
			
			data = {}
			data.main = itemTables
			
			break
		}

		case DataType.HeartParam: {
			const dataSection = findSection('.data')
			const stringSection = findSection('.rodata.str1.1')

			// use special relocations for main table because it's at the end of file
			let tableRelocs = peekable(allRelocations.get(".data"))

			let mainSymbol = findSymbol("wld::btl::data::s_Data")
			let dropTables = parseSymbol(dataSection, stringSection, mainSymbol, DataType.HeartParam, { count: -1, relocations: tableRelocs })

			debugger

			for (const table of dropTables) {
				const { drops: symbolName } = table

				if (symbolName == undefined)
					continue

				let symbol = findSymbol(symbolName)
				let children = parseSymbol(dataSection, stringSection, symbol, DataType.HeartItem, { count: -1 })

				let drops = {
					symbolName,
					children,
				}

				table.drops = drops
			}

			data = {}
			data.main = dropTables

			break
		}

		case DataType.Maplink: {
			const dataSection = findSection('.data')
			const dataStringSection = findSection('.rodata.str1.1')

			data = {}
			
			let headerRelocs = peekable(allRelocations.get(".data"))

			let headerSymbol = findSymbol("wld::fld::data::maplink::s_mapLink")
			let header = parseSymbol(dataSection, dataStringSection, headerSymbol, DataType.MaplinkHeader, { count: 1, relocations: headerRelocs })
			data.main = header

			// maplink nodes
			let { maplinks: symbolName, linkAmount } = header[0]
			let maplinkSymbol = findSymbol(symbolName)
			let maplinks = parseSymbol(dataSection, dataStringSection, maplinkSymbol, DataType.Maplink, { count: linkAmount })

			let maplinkObj = {
				symbolName,
				children: maplinks,
			}

			data.links = maplinks
			header[0].maplinks = maplinkObj

			break
		}

		case DataType.SndBattle: {
			const dataSection = findSection('.data')
			const dataStringSection = findSection('.rodata.str1.1')

			data = {}

			let headerRelocs = peekable(allRelocations.get(".data"))

			let headerSymbol = findSymbol("snd::data::s_battleDataList")
			let header = parseSymbol(dataSection, dataStringSection, headerSymbol, DataType.SndBattleHeader, { count: 1, relocations: headerRelocs })
			data.main = header

			// maplink nodes
			let { battletracks: symbolName, trackAmount } = header[0]
			let sndbattleSymbol = findSymbol(symbolName)
			let battletracks = parseSymbol(dataSection, dataStringSection, sndbattleSymbol, DataType.SndBattle, { count: trackAmount })

			let trackObj = {
				symbolName,
				children: battletracks,
			}

			data.tracks = battletracks
			header[0].battletracks = trackObj

			break
		}

		case DataType.DataMobjModel:{



			const dataSection = findSection('.data')
			const rodataSection = findSection('.rodata')
			const dataStringSection = findSection('.rodata.str1.1')
			let count: number
			
			let rodataView = new DataView(rodataSection.content)
			
			// object count in .data is stored somewhere in .rodata, at symbol wld::fld::data::modelNpc_num
			// because of name mangling, this equals _ZN3wld3fld4dataL12modelNpc_numE

				const dataView = new DataView(rodataSection.content)
				
				let mainSymbol = findSymbol("wld::fld::data::modelMobj_num")
				count = dataView.getBigInt64(mainSymbol.location.value, true)
			
			data = {}
			data.main = applyStrings(
				Pointer.ZERO, dataType, dataStringSection, 
				allRelocations.get('.data'), symbolTable,
				
				parseRawDataSection(dataSection, count, 0, dataType), 
			)
			
			
			parseModelRodata(data, data.main)				

					break
		}
		// parse .data section by data type
		default: {
			const dataSection = findSection('.data')
			const dataStringSection = findSection('.rodata.str1.1')
			const rodataSection = findSection('.rodata')
			
			let countSymbolName = FILE_TYPES[dataType].countSymbol
			let defaultPadding = FILE_TYPES[dataType].defaultPadding
			let count: number
			
			if (countSymbolName != null) {
				const dataView = new DataView(dataSection.content)
				
				let countSymbol = findSymbol(countSymbolName)
				count = dataView.getInt32(countSymbol.location.value, true)
			} else if (rodataSection != null) {
				// the .rodata Section usually only contains 4 bytes, which are the amount of objects in .data
				let rodataView = new DataView(rodataSection.content)
				count = rodataView.getInt32(0, true)
			} else {
				count = dataSection.size / FILE_TYPES[dataType].size - defaultPadding
			}
			
			data = {}
			data.main = parseRange(dataSection, dataStringSection, 0, count, dataType)
			
			break
		}
	}
	
	let binary = new ElfBinary(sections, data, symbolTable)
	
	console.log('binary', binary)
	console.log('data', data)
	
	return binary
	
	
	interface ParseSymbolProps {
		count?: number
		relocations?: Peekable<[number, Relocation]>
	}
	
	function parseSymbol<T extends DataType>(section: Section, stringSection: Section, symbol: Symbol, dataType: T, properties?: ParseSymbolProps) {
		let { count, relocations } = properties
		
		// if count is smaller than zero, calculate size like normal and subtract negative value from it
		let subtract = 0
		
		if (count < 0) {
			subtract = Math.abs(count)
			count = undefined
		}
		
		count = count ?? symbol.size / FILE_TYPES[dataType].size - subtract
		
		return parseRange(section, stringSection, symbol.location, count, dataType, relocations)
	}
	
	function parseRange<T extends DataType>(
		section: Section, stringSection: Section, startOffset: number | Pointer,
		count: number, dataType: T, relocations?: Peekable<[number, Relocation]>,
	) {
		const initialReaderPosition = section.reader.position
		let reader = section.reader
		let allowSkippingRelocations = relocations != undefined
		
		relocations = relocations ?? allRelocationIters.get(section.name)
		
		reader.position = typeof startOffset == 'number' ? startOffset : startOffset.value
		
		let result: Instance<T>[] = []
		
		for (let i = 0; i < count && reader.position < reader.arrayBuffer.byteLength; i++) {
			let offset = reader.position
			let obj = objFromReader(reader, dataType) as Instance<T>
			applyRelocations(obj, offset, relocations, symbolTable, stringSection, dataType, allowSkippingRelocations)
			
			obj[VALUE_UUID] = ValueUuid(DataType[dataType] + " " + obj[FILE_TYPES[dataType].identifyingField])
			
			result.push(obj)
		}
		
		reader.position = initialReaderPosition
		return result
	}
}

function objFromReader(reader: BinaryReader, dataType: DataType): UuidTagged {
	// @ts-expect-error
	let result: UuidTagged = {
		[DATA_TYPE]: dataType
	}
	
	for (const [fieldName, fieldType] of Object.entries(FILE_TYPES[dataType].typedef)) {
		switch (fieldType) {
			case "string":
				if (reader.readInt32() != 0)
					throw new Error(`Field '${fieldName}' on DataType ${DataType[dataType]} is a string when it contains non-pointer data`)
				if (reader.readInt32() != 0)
					throw new Error(`Field '${fieldName}' on DataType ${DataType[dataType]} is a string when it contains non-pointer data`)
				
				result[fieldName] = null
				break
			case "symbol":
				if (reader.readInt32() != 0)
					throw new Error(`Field '${fieldName}' on DataType ${DataType[dataType]} is a symbol when it contains non-pointer data`)
				if (reader.readInt32() != 0)
					throw new Error(`Field '${fieldName}' on DataType ${DataType[dataType]} is a symbol when it contains non-pointer data`)
				
				result[fieldName] = null
				break
			case "symbolAddr":
				if (reader.readInt32() != 0)
					throw new Error(`Field '${fieldName}' on DataType ${DataType[dataType]} is a symbolAddr when it contains non-pointer data`)
				if (reader.readInt32() != 0)
					throw new Error(`Field '${fieldName}' on DataType ${DataType[dataType]} is a symbolAddr when it contains non-pointer data`)
				
				result[fieldName] = null
				break
			case "Vector3":
				result[fieldName] = new Vector3(reader.readFloat32(), reader.readFloat32(), reader.readFloat32())
				break
			case "float":
				result[fieldName] = reader.readFloat32()
				break
			case "double":
				result[fieldName] = reader.readFloat64()
				break
			case "byte":
				result[fieldName] = reader.readUint8()
				break
			case "bool8":
				result[fieldName] = !!reader.readUint8()
				break
			case "bool32":
				result[fieldName] = !!reader.readUint32()
				break
			case "short":
				result[fieldName] = reader.readInt16()
				break
			case "int":
				result[fieldName] = reader.readInt32()
				break
			case "long":
				result[fieldName] = Number(reader.readBigInt64())
				break
			
			default:
				throw new Error(`Unknown data type ${JSON.stringify(fieldType)}`)
		}
	}
	
	return result
}

function applyRelocations<T extends DataType>(obj: Instance<T>, offset: number,
	relocations: Peekable<[number, Relocation]>, symbolTable: Symbol[], stringSection: Section,
	dataType: T, allowSkippingRelocations: boolean): void {
	
	if (relocations.peek() == null) {
		return
	}
	
	if (allowSkippingRelocations) {
		// consume iterator until fitting relocation found
		while (relocations.peek()[0] < offset) {
			relocations.next()
		}
	} else {
		// skipping relocations not allowed (default) so throw error
		if (relocations.peek()[0] < offset && !allowSkippingRelocations) {
			throw new Error("Skipping relocations")
		}
	}
	
	const size = FILE_TYPES[dataType].size
	
	while (relocations.peek() && relocations.peek()[0] < offset + size) {
		const [relocationOffset, relocation] = relocations.next().value
		let fieldName = FILE_TYPES[dataType].fieldOffsets[relocationOffset - offset] as string
		let fieldType = FILE_TYPES[dataType].typedef[fieldName]
		
		if (fieldName == undefined) {
			throw new Error(`Relocation to not existing field at offset 0x${(relocationOffset - offset).toString(16)} (${DataType[dataType]})`)
		}
		
		if (fieldType == "string") {
			obj[fieldName] = stringSection.getStringAt(relocation.targetOffset)
		} else if (fieldType == "symbol") {
			let targetSymbol = symbolTable[relocation.infoHigh]
			obj[fieldName] = targetSymbol.name
		} else if (fieldType == "symbolAddr") {
			let symbolOffset = relocation.targetOffset
			let symbol = symbolTable.find(sym => sym.location.equals(symbolOffset) && (sym.info & 0xf) == 1)
			
			if (symbol == undefined)
				throw new Error(`Couldn't find symbol with the offset ${symbolOffset}`)
			
			obj[fieldName] = symbol.name
		} else {
			throw new Error(`Field '${fieldName}' should be string or pointer, not '${fieldType}' (at offset 0x${offset.toString(16)}, ${DataType[dataType]})`)
		}
	}
}

function parseSymbol2<T extends DataType>(containingSection: Section, stringSection: Section, symbol: Symbol, dataType: T, count?: number) {
	// if count is smaller than zero, calculate size like normal and subtract negative value from it
	let subtract = 0
	
	if (count < 0) {
		subtract = Math.abs(count)
		count = undefined
	}
	
	count = count ?? symbol.size / FILE_TYPES[dataType].size - subtract
	
	return applyStrings(
		symbol.location, dataType, stringSection, allRelocations.get(containingSection.name), symbolTable,
		
		parseRawDataSection(containingSection, count, symbol.location, dataType),
	)
}


function parseRawDataSection(section: Section, count: number, initialPosition: number | Pointer, dataType: DataType): UuidTagged[] {
	const reader = new BinaryReader(section.content)
	
	reader.position = initialPosition instanceof Pointer ? initialPosition.value : initialPosition
	
	let result = []
	let i = 0
	
	while (reader.position < section.content.byteLength && i < count) {
		result.push(objFromReader(reader, dataType))
		i += 1
	}
	
	return result
	
	function objFromReader(reader: BinaryReader, dataType: DataType): UuidTagged {
		let result = {
			[VALUE_UUID]: ValueUuids(),
			[DATA_TYPE]: dataType,
		}
		
		for (let [fieldName, fieldType] of Object.entries(FILE_TYPES[dataType].typedef)) {
			
			switch (fieldType) {
				case "string":
					result[fieldName] = null
					reader.position += 8
					break
				case "symbol":
					result[fieldName] = null
					reader.position += 8
					break
				case "symbolAddr":
					result[fieldName] = null
					reader.position += 8
					break
				case "Vector3":
					result[fieldName] = new Vector3(reader.readFloat32(), reader.readFloat32(), reader.readFloat32())
					break
				case "float":
					result[fieldName] = reader.readFloat32()
					break
				case "double":
					result[fieldName] = reader.readFloat64()
					break
				case "byte":
					result[fieldName] = reader.readUint8()
					break
				case "bool8":
					result[fieldName] = !!reader.readUint8()
					break
				case "bool32":
					result[fieldName] = !!reader.readUint32()
					break
				case "short":
					result[fieldName] = reader.readInt16()
					break
				case "int":
					result[fieldName] = reader.readInt32()
					break
				case "long":
					result[fieldName] = Number(reader.readBigInt64())
					break
				
				default:
					throw new Error(`Unknown data type ${JSON.stringify(fieldType)}`)
			}
			
		}
		
		return result
	}
}

function applyStrings<T extends DataType>(baseOffsetPointer: Pointer, dataType: T, stringSection: Section, 
	relocationTable: Map<number, Relocation>, symbolTable: Symbol[], objects: UuidTagged[]): Instance<T>[] {
	
	let result = []
	
	const baseOffset = baseOffsetPointer.value
	
	for (const [offset, relocation] of relocationTable) {
		if (offset >= baseOffset && offset < baseOffset + FILE_TYPES[dataType].size * objects.length) {
			let size = FILE_TYPES[dataType].size
			let fieldOffset = (offset -  baseOffset) % size
			let fieldName = FILE_TYPES[dataType].fieldOffsets[fieldOffset]
			
			if (FILE_TYPES[dataType].typedef[fieldName] != "string" 
				&& FILE_TYPES[dataType].typedef[fieldName] != "symbolAddr"
				&& FILE_TYPES[dataType].typedef[fieldName] != "symbol") {
				console.error(`Field ${fieldName} should be a string instead of ${FILE_TYPES[dataType].typedef[fieldName]} \
(found in item ${Math.floor((offset - baseOffset) / size)}) ${DataType[dataType]} (0x${offset.toString(16)} / 0x${baseOffset.toString(16)})`)
			}
		}
	
	for (let i = 0; i < objects.length; i++) {
		const obj = objects[i]
		
		let copy = {...obj}
		Object.setPrototypeOf(copy, Object.getPrototypeOf(obj))
		
		for (const [fieldName, fieldType] of Object.entries(FILE_TYPES[dataType].typedef)) {
			if (fieldType == "string") {
				let fieldOffset = FILE_TYPES[dataType].fieldOffsets[fieldName] as number
				let size = FILE_TYPES[dataType].size as number
				let relocation: Relocation = relocationTable.get(fieldOffset + size * i + baseOffset)
				
				copy[fieldName] = stringSection.getStringAt(relocation ? relocation.targetOffset : Pointer.NULL)
			} 
			else if (fieldType == "symbol") {
				let fieldOffset = FILE_TYPES[dataType].fieldOffsets[fieldName] as number
				let size = FILE_TYPES[dataType].size as number
				let relocation: Relocation = relocationTable.get(fieldOffset + size * i + baseOffset)
				let targetSymbol = symbolTable[relocation?.infoHigh]
				
				// console.log('symbol', relocation?.infoHigh, symbolTable)
				
				copy[fieldName] = demangle(targetSymbol?.name) ?? null
			} 
			else if (fieldType == "symbolAddr") {
				let fieldOffset = FILE_TYPES[dataType].fieldOffsets[fieldName] as number
				let size = FILE_TYPES[dataType].size as number
				let relocation: Relocation = relocationTable.get(fieldOffset + size * i + baseOffset)
				copy[fieldName] = relocation ? relocation.targetOffset : Pointer.NULL
			}
		}
		
		result.push(copy)
	}
	
	return result
}
}