import $ from 'jquery';
import { bitable, FieldType } from '@lark-base-open/js-sdk';
import './index.scss';
import './locales/i18n'; // 开启国际化，详情请看README.md

function showLoadingOverlay() {
  document.getElementById('loadingStatus').innerText = '';
  document.getElementById('loadingOverlay').style.display = 'flex';
  document.getElementById('loadEndOverlay').style.display = 'none';
}

function hideOverlay() {
  document.getElementById('loadingOverlay').style.display = 'none';
  document.getElementById('loadEndOverlay').style.display = 'none';
}

function updateLoadingProgress(statusText, current, total) {
  const progressText = statusText + `${current}/${total}`;
  document.getElementById('loadingStatus').innerText = `${progressText}`;
}

function updateAnalyzeProgress(statusText, current, total) {
  const progressText = statusText + `${current}/${total}`;
  document.getElementById('loadingStatus').innerText = `${progressText}`;
}

function showConfirmation(statusText, current, total) {
  const progressText = statusText + `${current}/${total}`;
  document.getElementById('loadEndStatus').innerText = `${progressText}`;
  document.getElementById('loadingOverlay').style.display = 'none';
  document.getElementById('loadEndOverlay').style.display = 'flex';

  document.getElementById('btnConfirm').focus();
}

function getFileExtension(filename) {
  return filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 1);
}

$('#btnConfirm').on('click', async function() {
  hideOverlay();
});

$(async function() {

  const KEY_FIELD_NAME = "key";
  const TRA_FIELD_NAME = "translatable";


  // 监听选择文件
  const inputFile = document.getElementById('inputFile');
  const inputLang = document.getElementById('inputLang');
  const inputAppName = document.getElementById('inputAppName');
  const btnAnalyzeFile = document.getElementById('btnAnalyzeFile');

  inputFile.addEventListener('change', updateButtonState);
  inputLang.addEventListener('input', updateButtonState);
  inputAppName.addEventListener('input', updateButtonState);

  function updateButtonState() {
    if (inputFile.files.length > 0 && inputLang.value.trim() !== '' && inputAppName.value.trim() !== '') {
      btnAnalyzeFile.removeAttribute('disabled');
    } else {
      btnAnalyzeFile.setAttribute('disabled', true);
    }
  }

  // 解析文件
  $('#btnAnalyzeFile').on('click', async function() {
    // btnAnalyzeFile.addEventListener('click', async function() {

    // 显示加载图标
    showLoadingOverlay();

    console.time("解析文件时间");

    const file = inputFile.files[0];
    if (file) {

      console.log('Input File:', file.name);
      console.log('Input Language:', inputLang.value)
      console.log('Input AppName:', inputAppName.value)

      let fileTable = null;
      let langField = null;
      let keyField = null;
      let traField = null;
      let currProgress = 0;
      let totalProgress = 0;

      //创建数据表
      try {
        await bitable.base.addTable({
          name: inputAppName.value,
          fields: [
            {
              name: KEY_FIELD_NAME,
              type: FieldType.Text
            },
            {
              name: TRA_FIELD_NAME,
              type: FieldType.Text
            },
            {
              name: inputLang.value,
              type: FieldType.Text
            }
          ]
        })

      } catch (error) {
        console.log('Table is exist.');
      }

      //获取数据表
      fileTable = await bitable.base.getTableByName(inputAppName.value);

      console.log('Get table:', fileTable);

      //获取/创建Key字段
      try {
        await fileTable.addField({ name: KEY_FIELD_NAME, type: FieldType.Text });
      } catch (error) {
        console.log('Key field is exist.', keyField);
      }

      keyField = await fileTable.getFieldByName<ITextFieldConfig>(KEY_FIELD_NAME);
      console.log('Get key field :', keyField);
      //获取/创建translatable字段
      try {

        await fileTable.addField({ name: TRA_FIELD_NAME, type: FieldType.Text });

      } catch (error) {

        console.log('Tra field is exist.', traField);
      }
      traField = await fileTable.getFieldByName<ITextFieldConfig>(TRA_FIELD_NAME);
      console.log('Get tra field :', traField);
      //获取/创建语言字段
      try {

        await fileTable.addField({ name: inputLang.value, type: FieldType.Text });

      } catch (error) {

        console.log('Language field is exist.', langField);
      }

      langField = await fileTable.getFieldByName<ITextFieldConfig>(inputLang.value);
      console.log('Get language field :', langField);

      // 创建一个Map对象(key, value, record id)来存储Record
      const recordMap = new Map<string, string>();
      const recordList = await fileTable.getRecordList();
      console.log('Get record list:', recordList, recordList.recordIdList.length);

      currProgress = 0;
      totalProgress = recordList.recordIdList.length;
      updateLoadingProgress($.t('loading_table'), currProgress, totalProgress);

      for (const record of recordList) {
        // const keyCell = await record.getCellByField(keyField);
        // const keyVal = await keyCell.getValue();

        const keyVal = await fileTable.getCellValue(keyField.id, record.id);
        const traVal = await fileTable.getCellValue(traField.id, record.id);
        currProgress++;
        updateLoadingProgress($.t('loading_table'), currProgress, totalProgress);

        // const langCell = await record.getCellByField(langField);
        // const langVal = await langCell.getValue();

        console.log("key Val:", keyVal);
        console.log("tra Val:", traVal);

        if (keyVal) {
          recordMap.set(keyVal[0].text, record.id);

          console.log('get key record:', keyVal[0].text, ' ', record.id);
        }

        // if (traVal) {
        //   recordMap.set(traVal[0].text, record.id);

        //   console.log('get tra record:', traVal[0].text, ' ', record.id);
        // }
        // else
        // {
        //   // 删除空行
        //   await fileTable.deleteRecord(record);
        // }
      }

      // 替换实体字符<>&为的实体名称
      function convertToEntities(str) {
        return str.replace(/&/g, "&amp;") //
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        // .replace(/@/g, "&commat;");
      }

      const reader = new FileReader();

      reader.onload = async function(event) {
        const fileContent = event.target.result;
        let keyValuePairs = null;
        let arrayValuePairs = null;
        let key = null;
        let value = null;
        let tra = null;
        let isXmlType = false;
        let recordsToBeAdded = [];
        let recordsToBeUpdate = [];

        const fileExtension = file.name.slice((file.name.lastIndexOf(".") - 1 >>> 0) + 1);
        console.log('fileExtension:', fileExtension);
        if (fileExtension === '.xml') {
          // 解析 XML 文件
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(fileContent, "application/xml");
          keyValuePairs = xmlDoc.getElementsByTagName("string");
          arrayValuePairs = xmlDoc.getElementsByTagName("string-array");
          console.log('arrayValuePairs :', arrayValuePairs);
          // console.log('&lt;font color=#ff0000&gt;New Version %s&lt;/font&gt;');

          isXmlType = true;
        } else if (fileExtension === '.strings') {
          // 使用正则表达式提取"key"和"value"
          keyValuePairs = fileContent.match(/"([^"]+)"\s*=\s*"((?:\\"|[^"])*)"/g);

          isXmlType = false;
        }

        console.log('keyValuePairs:', keyValuePairs.length);

        currProgress = 0;
        totalProgress = keyValuePairs.length;
        updateLoadingProgress($.t('analyze_to_table'), currProgress, totalProgress);

        if (keyValuePairs) {
          for (const pair of keyValuePairs) {

            if (isXmlType) {
              key = pair.getAttribute("name");
              value = pair.textContent;
              value = convertToEntities(value);
              tra = pair.getAttribute(TRA_FIELD_NAME);
              console.log('translatable:', tra);
              // console.log('strings:', value);
            } else {
              const matches = pair.match(/"([^"]+)"\s*=\s*"((?:\\"|[^"])*)"/);
              if (matches) {
                key = matches[1];
                value = matches[2];
              }
            }

            // currProgress++;
            // updateLoadingProgress($.t('analyze_to_table'), currProgress, totalProgress);

            if (recordMap.has(key)) {
              let record = {
                recordId: recordMap.get(key),
                fields: {
                  [langField.id]: value,
                  [traField.id]: tra,
                }
              };
              recordsToBeUpdate.push(record);

            }
            else {
              // const newKeyCell = await keyField.createCell(key);
              // const newLangCell = await langField.createCell(value);

              let record = {
                fields: {
                  [keyField.id]: key,
                  [langField.id]: value,
                  [traField.id]: tra,
                }
              };
              recordsToBeAdded.push(record);
            }

            console.log('Key:', key);
            console.log('Value:', value);
          }

          console.log('recordsToBeAdded:', recordsToBeAdded.length);
          console.log('recordsToBeUpdate:', recordsToBeUpdate.length);

          // 设置每批次最大记录数
          const MAX_RECORDS_PER_BATCH = 1000;
          // 准备存储所有添加成功的记录ID
          // let allAddedRecordIds = [];

          // 使用循环来分批次更新记录
          for (let i = 0; i < recordsToBeUpdate.length; i += MAX_RECORDS_PER_BATCH) {
            // 创建一个批次的记录数组，确保不会超出数组界限
            let batchRecords = recordsToBeUpdate.slice(i, i + MAX_RECORDS_PER_BATCH);

            currProgress += batchRecords.length;
            updateLoadingProgress($.t('analyze_to_table'), currProgress, totalProgress);

            // 使用 addRecords 方法更新当前批次的记录
            const res = await fileTable.setRecords(batchRecords);

            // 将更新成功的记录ID存储起来
            // allAddedRecordIds.push(...res);
          }

          // 使用循环来分批次添加记录
          for (let i = 0; i < recordsToBeAdded.length; i += MAX_RECORDS_PER_BATCH) {
            // 创建一个批次的记录数组，确保不会超出数组界限
            let batchRecords = recordsToBeAdded.slice(i, i + MAX_RECORDS_PER_BATCH);

            currProgress += batchRecords.length;
            updateLoadingProgress($.t('analyze_to_table'), currProgress, totalProgress);

            // 使用 addRecords 方法添加当前批次的记录
            const res = await fileTable.addRecords(batchRecords);

            // 将添加成功的记录ID存储起来
            // allAddedRecordIds.push(...res);
          }

          // const recordIds = await fileTable.addRecords(records);
          // console.log('recordIds 1:', recordIds);
          // const recordIds = await fileTable.addRecords(records);
          // console.log('recordIds 1:', recordIds);
        }

        console.timeEnd("解析文件时间");

        // 加载完成
        showConfirmation($.t('analyze_to_table_finish'), currProgress, totalProgress);

        updateTableList();
      };

      reader.readAsText(file);

    }
  });

  bitable.base.onTableAdd((event) => {
    console.log('table added')
    updateTableList();
  })

  bitable.base.onTableDelete((event) => {
    console.log('table deleted')
    updateTableList();
  })

  const btnExportFile = document.getElementById('btnExportFile');
  const btnExportFile_all = document.getElementById('btnExportFile_all');
  //btnExportFile_all.removeAttribute('disabled');

  async function updateFieldList(tableId: string) {
    const currTable = await bitable.base.getTableById(tableId!);

    const fieldList = await currTable.getFieldMetaList();

    console.log('选中的值为:', currTable);

    console.log('字段列表为:', fieldList);

    $('#fieldLangSelect').empty();

    const fieldOptionsHtml = fieldList.map(field => {
      if (field.name !== KEY_FIELD_NAME && field.name !== TRA_FIELD_NAME) {
        // console.log('字段:', field.id, field.name);
        return `<option value="${field.id}">${field.name}</option>`;
      }
    }).join('');


    // $('#fieldLangSelect').append(fieldOptionsHtml).val(fieldList[0].id!);
    $('#fieldLangSelect').append(fieldOptionsHtml);

    $('#fieldTypeSelect').empty();

    const plaOptionsHtml = [{ id: 'ios', name: 'ios' }, { id: 'android', name: 'android' }].map(field => {
      if (field.name !== KEY_FIELD_NAME && field.name !== TRA_FIELD_NAME) {
        // console.log('字段:', field.id, field.name);
        return `<option value="${field.id}">${field.name}</option>`;
      }
    }).join('');

    $('#fieldTypeSelect').append(plaOptionsHtml);


    //const tableSelect = document.getElementById('tableSelect');
    const fieldLangSelect = document.getElementById('fieldLangSelect');
    const fieldTypeSelect = document.getElementById('fieldTypeSelect');

    fieldLangSelect.selectedIndex = 0;

    fieldTypeSelect.selectedIndex = 0;

    // console.log('selectedIndex:', tableSelect.selectedIndex, fieldLangSelect.selectedIndex);
    if (/*tableSelect.length !== 0 && */fieldLangSelect.length !== 0 && fieldTypeSelect.length !== 0 && fieldList.length >= 2) {
      btnExportFile.removeAttribute('disabled');
      btnExportFile_all.removeAttribute('disabled');
    } else {
      btnExportFile.setAttribute('disabled', true);
    }
  }

  async function updateTableList() {
    const [tableList, tableSelection] = await Promise.all([bitable.base.getTableMetaList(), bitable.base.getSelection()]);
    // const tableOptionsHtml = tableList.map(table => {
    //   return `<option value="${table.id}">${table.name}</option>`;
    // }).join('');

    //$('#tableSelect').empty();

    //$('#tableSelect').append(tableOptionsHtml).val(tableSelection.tableId!);

    updateFieldList(tableSelection.tableId);

    // $('#tableSelect').on('change', async function() {
    //   const tableId = $('#tableSelect').val();

    //   console.log('tableId:', tableId);
    //   updateFieldList(tableId);
    // });
  }

  updateTableList();

  // 导出文件
  $('#btnExportFile').on('click', async function() {

    let exportTable = null;
    let exportTableName = null;
    let exportFieldName = null;
    let exportFieldType = null;
    let fileExtension = null;
    let langField = null;
    let keyField = null;
    let traField = null;
    let currProgress = 0;
    let totalProgress = 0;
    let strVal = null;
    // 显示加载图标
    showLoadingOverlay();
    //const olda = document.getele("downloadFile");
    const [tableList, tableSelection] = await Promise.all([bitable.base.getTableMetaList(), bitable.base.getSelection()]);
    const tableId = tableSelection.tableId;
    exportFieldName = fieldLangSelect.options[fieldLangSelect.selectedIndex].text;
    exportFieldType = fieldTypeSelect.options[fieldTypeSelect.selectedIndex].text;
    if (exportFieldType === "ios") {
      exportTableName = 'Localizable.strings';
    } else if (exportFieldType === "android") {
      exportTableName = 'strings.xml';
    }

    fileExtension = getFileExtension(exportTableName);

    console.log('tableSelect:', exportTableName, tableId);

    console.log('fileExtension:', fileExtension);

    //获取数据表
    exportTable = await bitable.base.getTableById(tableId);

    console.log('Get table:', exportTable);

    keyField = await exportTable.getFieldByName<ITextFieldConfig>(KEY_FIELD_NAME);
    console.log('Get key field :', keyField);
    //const fieldMetaList = await exportTable.getFieldMetaList();
    const parentDiv = document.getElementsByClassName("downloadFile-group");
    console.log("parentDiv:", parentDiv);
    const olda = document.getElementById('downloadFile' + exportFieldName);
    const oldbr1 = document.getElementById('br' + exportFieldName);
    if (olda !== null) {
      //olda.innerText = null;
      parentDiv[0].removeChild(olda);
      parentDiv[0].removeChild(oldbr1);
    }
    // 显示加载图标
    showLoadingOverlay();
    if (exportFieldType === "android") {
      traField = await exportTable.getFieldByName<ITextFieldConfig>(TRA_FIELD_NAME);
    }
    //traField = await exportTable.getFieldByName<ITextFieldConfig>(TRA_FIELD_NAME);
    langField = await exportTable.getFieldByName<ITextFieldConfig>(exportFieldName);
    console.log('Get language field :', langField);

    console.time("导出文件时间");

    // 创建一个Map对象(key, value, record id)来存储Record
    const recordMap = new Map<string, string>();
    const traRecordMap = new Map<string, string>();
    const recordList = await exportTable.getRecordList();

    console.log('Get record list:', recordList, recordList.recordIdList.length);

    currProgress = 0;
    totalProgress = recordList.recordIdList.length;
    updateLoadingProgress($.t('export_to_file'), currProgress, totalProgress);

    for (const record of recordList) {
      // const keyCell = await record.getCellByField(keyField);
      // const keyVal = await keyCell.getValue();

      // const langCell = await record.getCellByField(langField);
      // const langVal = await langCell.getValue();

      const keyVal = await exportTable.getCellValue(keyField.id, record.id);
      const langVal = await exportTable.getCellValue(langField.id, record.id);

      currProgress++;
      updateLoadingProgress($.t('export_to_file'), currProgress, totalProgress);

      // console.log("key lang:", keyVal, langVal);

      if (keyVal && langVal) {
        recordMap.set(keyVal[0].text, langVal[0].text);
        if (exportFieldType === "android") {
          const traVal = await exportTable.getCellValue(traField.id, record.id);
          if (traVal) {
            traRecordMap.set(keyVal[0].text, traVal[0].text);
          }
        }
        //recordMap.set(keyVal[0].text + 'translatable', traVal[0].text);
        console.log('get out record:', keyVal[0].text);
      }
    }

    let formattedData = "";

    if (exportFieldType === "ios") {
      // 将键值对转换为 "key" = "value" 格式的字符串
      formattedData = Array.from(recordMap.entries()).map(([key, value]) => `"${key}" = "${value.replaceAll('%s', '%@')}";`).join('\n');
      console.log('format .strings data.');
    } else if (exportFieldType === "android") {
      formattedData = `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n` +
        Array.from(recordMap.entries()).map(([key, value]) => {
          if (traRecordMap.has(key)) {
            console.log('traRecordMap.get(key).', traRecordMap.get(key));
            strVal = `   <string name="${key}" translatable="${traRecordMap.get(key)}">${value.replaceAll('%@', '%s')}</string>`;
          } else {
            strVal = `   <string name="${key}">${value.replaceAll('%@', '%s')}</string>`;
          }
          return strVal;
        }).join('\n') +
        `\n</resources>`;
      console.log('format .xml data.');
    }

    console.log(formattedData);

    // 创建Blob对象
    const file: Blob = new Blob([formattedData], { type: fileExtension });

    //console.log("file:", file);

    // 创建URL
    const fileURL: string = URL.createObjectURL(file);

    console.log("fileURL:", fileURL);
    const a1 = document.createElement("a");
    a1.id = 'downloadFile' + exportFieldName;
    a1.href = fileURL;
    a1.download = exportTableName;
    a1.innerText = $.t('download_file') + exportTableName + " : " + exportFieldName;
    parentDiv[0].appendChild(a1);
    const br1 = document.createElement("br");
    br1.id = 'br' + exportFieldName;
    parentDiv[0].appendChild(br1);
    console.timeEnd("导出文件时间");
    // 设置点击事件处理器
    // a1.addEventListener('click', () => {
    //     // 设置定时器以清理资源
    //     setTimeout(() => {
    //       console.log("Clean resource:", fileURL);
    //       window.URL.revokeObjectURL(fileURL);
    //     }, 10000); // 例如，10秒后清理
    // });

    // 加载完成
    showConfirmation($.t('export_file_finish'), currProgress, totalProgress);
  });

  // 导出全部文件
  $('#btnExportFile_all').on('click', async function() {

    let exportTable = null;
    let exportTableName = null;
    let exportFieldName = null;
    let exportFieldType = null;
    let fileExtension = null;
    let langField = null;
    let keyField = null;
    let traField = null;
    let currProgress = 0;
    let totalProgress = 0;
    let strVal = null;
    // 显示加载图标
    showLoadingOverlay();
    //const olda = document.getele("downloadFile");
    const [tableList, tableSelection] = await Promise.all([bitable.base.getTableMetaList(), bitable.base.getSelection()]);
    const tableId = tableSelection.tableId;
    exportFieldName = fieldLangSelect.options[fieldLangSelect.selectedIndex].text;
    exportFieldType = fieldTypeSelect.options[fieldTypeSelect.selectedIndex].text;
    if (exportFieldType === "ios") {
      exportTableName = 'Localizable.strings';
    } else if (exportFieldType === "android") {
      exportTableName = 'strings.xml';
    }

    fileExtension = getFileExtension(exportTableName);

    console.log('tableSelect:', exportTableName, tableId);

    console.log('fileExtension:', fileExtension);

    //获取数据表
    exportTable = await bitable.base.getTableById(tableId);

    console.log('Get table:', exportTable);

    keyField = await exportTable.getFieldByName<ITextFieldConfig>(KEY_FIELD_NAME);
    console.log('Get key field :', keyField);
    const fieldMetaList = await exportTable.getFieldMetaList();
    const parentDiv = document.getElementsByClassName("downloadFile-group");
    console.log("parentDiv:", parentDiv);
    for (const meta of fieldMetaList) {
      console.log('Get fieldMetaList :', meta.name);
      if (meta.name === KEY_FIELD_NAME || meta.name === TRA_FIELD_NAME) {
        continue;
      }
      const olda = document.getElementById('downloadFile' + meta.name);
      const oldbr1 = document.getElementById('br' + meta.name);
      if (olda !== null) {
        //olda.innerText = null;
        parentDiv[0].removeChild(olda);
        parentDiv[0].removeChild(oldbr1);
      }
      // 显示加载图标
      showLoadingOverlay();
      langField = await exportTable.getFieldByName<ITextFieldConfig>(meta.name);
      if (exportFieldType === "android") {
        traField = await exportTable.getFieldByName<ITextFieldConfig>(TRA_FIELD_NAME);
      }
      console.log('Get language field :', langField);

      console.time("导出文件时间");

      // 创建一个Map对象(key, value, record id)来存储Record
      const recordMap = new Map<string, string>();
      const traRecordMap = new Map<string, string>();
      const recordList = await exportTable.getRecordList();

      console.log('Get record list:', recordList, recordList.recordIdList.length);

      currProgress = 0;
      totalProgress = recordList.recordIdList.length;
      updateLoadingProgress($.t('export_to_file'), currProgress, totalProgress);

      for (const record of recordList) {
        // const keyCell = await record.getCellByField(keyField);
        // const keyVal = await keyCell.getValue();

        // const langCell = await record.getCellByField(langField);
        // const langVal = await langCell.getValue();

        const keyVal = await exportTable.getCellValue(keyField.id, record.id);
        const langVal = await exportTable.getCellValue(langField.id, record.id);

        currProgress++;
        updateLoadingProgress($.t('export_to_file'), currProgress, totalProgress);

        // console.log("key lang:", keyVal, langVal);

        if (keyVal && langVal) {
          recordMap.set(keyVal[0].text, langVal[0].text);
          if (exportFieldType === "android") {
            const traVal = await exportTable.getCellValue(traField.id, record.id);
            if (traVal) {
              traRecordMap.set(keyVal[0].text, traVal[0].text);
            }
          }
          console.log('get record:', keyVal[0].text, langVal[0].text);
        }
      }

      let formattedData = "";

      if (exportFieldType === "ios") {
        // 将键值对转换为 "key" = "value" 格式的字符串
        formattedData = Array.from(recordMap.entries()).map(([key, value]) => `"${key}" = "${value}";`).join('\n');

        console.log('format .strings data.');
      } else if (exportFieldType === "android") {
        formattedData = `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n` +
          Array.from(recordMap.entries()).map(([key, value]) => {
            if (traRecordMap.has(key)) {
              console.log('traRecordMap.get(key).', traRecordMap.get(key));
              strVal = `   <string name="${key}" translatable="${traRecordMap.get(key)}">${value}</string>`;
            } else {
              strVal = `   <string name="${key}">${value}</string>`;
            }
            return strVal;
          }).join('\n') +
          `\n</resources>`;
        console.log('format .xml data.');
      }

      console.log(formattedData);

      // 创建Blob对象
      const file: Blob = new Blob([formattedData], { type: fileExtension });

      //console.log("file:", file);

      // 创建URL
      const fileURL: string = URL.createObjectURL(file);

      console.log("fileURL:", fileURL);
      const a1 = document.createElement("a");
      a1.id = 'downloadFile' + meta.name;
      a1.href = fileURL;
      a1.download = exportTableName;
      a1.innerText = $.t('download_file') + exportTableName + " : " + meta.name;
      parentDiv[0].appendChild(a1);
      const br1 = document.createElement("br");
      br1.id = 'br' + meta.name;
      parentDiv[0].appendChild(br1);
      console.timeEnd("导出文件时间");
      // 设置点击事件处理器
      // a1.addEventListener('click', () => {
      //     // 设置定时器以清理资源
      //     setTimeout(() => {
      //       console.log("Clean resource:", fileURL);
      //       window.URL.revokeObjectURL(fileURL);
      //     }, 10000); // 例如，10秒后清理
      // });

      // 加载完成
      showConfirmation($.t('export_file_finish'), currProgress, totalProgress);
    }
  });

});


