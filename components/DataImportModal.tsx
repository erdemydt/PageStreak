import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import {
    BackupValidationResult,
    getBackupInfo,
    importDataFromBackup,
    ImportOptions,
    pickBackupFile,
    validateBackupFile,
} from '../services/dataBackupService';

interface DataImportModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (importedData: { books: number; sessions: number }) => void;
}

type ImportStep = 'select' | 'validate' | 'configure' | 'import' | 'complete';

export default function DataImportModal({ visible, onClose, onSuccess }: DataImportModalProps) {
  const [currentStep, setCurrentStep] = useState<ImportStep>('select');
  const [selectedFileUri, setSelectedFileUri] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<BackupValidationResult | null>(null);
  const [backupInfo, setBackupInfo] = useState<any>(null);
  const [importOptions, setImportOptions] = useState<ImportOptions>({
    mode: 'merge',
    validateIntegrity: true,
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingMessage, setProcessingMessage] = useState('');
  const [importResult, setImportResult] = useState<{ books: number; sessions: number } | null>(null);

  const resetState = () => {
    setCurrentStep('select');
    setSelectedFileUri(null);
    setValidationResult(null);
    setBackupInfo(null);
    setImportOptions({ mode: 'merge', validateIntegrity: true });
    setIsProcessing(false);
    setProcessingProgress(0);
    setProcessingMessage('');
    setImportResult(null);
  };

  const handleClose = () => {
    if (!isProcessing) {
      resetState();
      onClose();
    }
  };

  const handleFileSelect = async () => {
    setIsProcessing(true);
    setProcessingMessage('Selecting file...');

    try {
      const result = await pickBackupFile();
      
      if (result.success && result.fileUri) {
        setSelectedFileUri(result.fileUri);
        setProcessingMessage('Validating backup file...');
        
        // Validate the file
        const validation = await validateBackupFile(result.fileUri);
        setValidationResult(validation);
        
        if (validation.isValid) {
          // Get detailed info
          const info = await getBackupInfo(result.fileUri);
          if (info.success) {
            setBackupInfo(info.info);
          }
          setCurrentStep('validate');
        } else {
          Alert.alert(
            'Invalid Backup File',
            `The selected file is not a valid PageStreak backup:\n\n${validation.errors.join('\n')}`,
            [{ text: 'OK', onPress: () => setCurrentStep('select') }]
          );
        }
      } else {
        if (result.error && !result.error.includes('cancelled')) {
          Alert.alert('File Selection Failed', result.error);
        }
      }
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to select file');
    } finally {
      setIsProcessing(false);
      setProcessingMessage('');
    }
  };

  const handleValidationNext = () => {
    if (validationResult?.warnings.length) {
      Alert.alert(
        'Backup Warnings',
        `The backup file has some warnings:\n\n${validationResult.warnings.join('\n')}\n\nDo you want to continue?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue', onPress: () => setCurrentStep('configure') },
        ]
      );
    } else {
      setCurrentStep('configure');
    }
  };

  const handleImport = async () => {
    if (!selectedFileUri) return;

    setIsProcessing(true);
    setProcessingProgress(0);
    setProcessingMessage('Starting import...');
    setCurrentStep('import');

    try {
      // Show warning for replace mode
      if (importOptions.mode === 'replace') {
        const confirmed = await new Promise<boolean>((resolve) => {
          Alert.alert(
            'Replace All Data?',
            'This will DELETE all your current data and replace it with the backup. This action cannot be undone. Are you sure?',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Replace All Data', style: 'destructive', onPress: () => resolve(true) },
            ]
          );
        });

        if (!confirmed) {
          setCurrentStep('configure');
          setIsProcessing(false);
          return;
        }
      }

      const result = await importDataFromBackup(
        selectedFileUri,
        importOptions,
        (progress, message) => {
          setProcessingProgress(progress);
          setProcessingMessage(message);
        }
      );

      if (result.success) {
        setImportResult(result.imported);
        setCurrentStep('complete');
        onSuccess?.(result.imported);
      } else {
        Alert.alert('Import Failed', result.error || 'An unknown error occurred');
        setCurrentStep('configure');
      }
    } catch (error) {
      Alert.alert('Import Failed', error instanceof Error ? error.message : 'An unknown error occurred');
      setCurrentStep('configure');
    } finally {
      setIsProcessing(false);
      setProcessingProgress(0);
      setProcessingMessage('');
    }
  };

  const renderSelectStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Ionicons name="document" size={48} color="#6C63FF" />
        <Text style={styles.stepTitle}>Select Backup File</Text>
        <Text style={styles.stepDescription}>
          Choose a PageStreak backup file (.json) to restore your data
        </Text>
      </View>

      <View style={styles.instructionsCard}>
        <Text style={styles.instructionsTitle}>Supported Files</Text>
        <View style={styles.instructionItem}>
          <Ionicons name="checkmark-circle" size={16} color="#10B981" />
          <Text style={styles.instructionText}>PageStreak backup files (.json)</Text>
        </View>
        <View style={styles.instructionItem}>
          <Ionicons name="checkmark-circle" size={16} color="#10B981" />
          <Text style={styles.instructionText}>Files from PageStreak v1.0 and later</Text>
        </View>
        <View style={styles.instructionItem}>
          <Ionicons name="information-circle" size={16} color="#F59E0B" />
          <Text style={styles.instructionText}>Files created with Export Data feature</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, isProcessing && styles.disabledButton]}
        onPress={handleFileSelect}
        disabled={isProcessing}
      >
        {isProcessing ? (
          <>
            <ActivityIndicator color="#FFFFFF" size="small" />
            <Text style={styles.primaryButtonText}>{processingMessage}</Text>
          </>
        ) : (
          <>
            <Ionicons name="folder-open" size={20} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>Choose File</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderValidateStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Ionicons name="checkmark-circle" size={48} color="#10B981" />
        <Text style={styles.stepTitle}>Backup Validated</Text>
        <Text style={styles.stepDescription}>
          Your backup file is valid and ready to import
        </Text>
      </View>

      {backupInfo && (
        <View style={styles.backupInfoCard}>
          <Text style={styles.backupInfoTitle}>Backup Information</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Created:</Text>
            <Text style={styles.infoValue}>
              {new Date(backupInfo.createdAt).toLocaleDateString()}
            </Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Books:</Text>
            <Text style={styles.infoValue}>{backupInfo.totalBooks}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Reading Sessions:</Text>
            <Text style={styles.infoValue}>{backupInfo.totalSessions}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>File Size:</Text>
            <Text style={styles.infoValue}>{backupInfo.fileSize}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>User Preferences:</Text>
            <Text style={styles.infoValue}>
              {backupInfo.hasUserPreferences ? 'Included' : 'Not included'}
            </Text>
          </View>
        </View>
      )}

      {validationResult && validationResult.warnings && validationResult.warnings.length > 0 && (
        <View style={styles.warningCard}>
          <Ionicons name="warning" size={20} color="#F59E0B" />
          <View style={styles.warningContent}>
            <Text style={styles.warningTitle}>Warnings</Text>
            {validationResult.warnings.map((warning, index) => (
              <Text key={index} style={styles.warningText}>• {warning}</Text>
            ))}
          </View>
        </View>
      )}

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => setCurrentStep('select')}
        >
          <Text style={styles.secondaryButtonText}>Choose Different File</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleValidationNext}
        >
          <Text style={styles.primaryButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderConfigureStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Ionicons name="settings" size={48} color="#6C63FF" />
        <Text style={styles.stepTitle}>Import Options</Text>
        <Text style={styles.stepDescription}>
          Choose how you want to import your data
        </Text>
      </View>

      <View style={styles.optionsCard}>
        <Text style={styles.optionsTitle}>Import Mode</Text>
        
        <TouchableOpacity
          style={[
            styles.optionButton,
            importOptions.mode === 'merge' && styles.optionButtonSelected
          ]}
          onPress={() => setImportOptions(prev => ({ ...prev, mode: 'merge' }))}
        >
          <View style={styles.optionContent}>
            <View style={styles.optionHeader}>
              <Ionicons 
                name="git-merge" 
                size={20} 
                color={importOptions.mode === 'merge' ? '#6C63FF' : '#6B7280'} 
              />
              <Text style={[
                styles.optionTitle,
                importOptions.mode === 'merge' && styles.optionTitleSelected
              ]}>
                Merge Data (Recommended)
              </Text>
            </View>
            <Text style={styles.optionDescription}>
              Add backup data to your existing data. Duplicate entries will be updated.
            </Text>
          </View>
          <View style={[
            styles.radioButton,
            importOptions.mode === 'merge' && styles.radioButtonSelected
          ]}>
            {importOptions.mode === 'merge' && (
              <View style={styles.radioButtonInner} />
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.optionButton,
            importOptions.mode === 'replace' && styles.optionButtonSelected
          ]}
          onPress={() => setImportOptions(prev => ({ ...prev, mode: 'replace' }))}
        >
          <View style={styles.optionContent}>
            <View style={styles.optionHeader}>
              <Ionicons 
                name="refresh" 
                size={20} 
                color={importOptions.mode === 'replace' ? '#6C63FF' : '#6B7280'} 
              />
              <Text style={[
                styles.optionTitle,
                importOptions.mode === 'replace' && styles.optionTitleSelected
              ]}>
                Replace All Data
              </Text>
            </View>
            <Text style={styles.optionDescription}>
              Delete all current data and replace with backup. This cannot be undone.
            </Text>
          </View>
          <View style={[
            styles.radioButton,
            importOptions.mode === 'replace' && styles.radioButtonSelected
          ]}>
            {importOptions.mode === 'replace' && (
              <View style={styles.radioButtonInner} />
            )}
          </View>
        </TouchableOpacity>
      </View>

      {importOptions.mode === 'replace' && (
        <View style={styles.dangerCard}>
          <Ionicons name="warning" size={20} color="#EF4444" />
          <Text style={styles.dangerText}>
            Warning: This will permanently delete all your current books, reading sessions, and progress. Make sure to export your current data first if you want to keep it.
          </Text>
        </View>
      )}

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => setCurrentStep('validate')}
        >
          <Text style={styles.secondaryButtonText}>Back</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleImport}
        >
          <Text style={styles.primaryButtonText}>
            {importOptions.mode === 'replace' ? 'Replace Data' : 'Import Data'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderImportStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={styles.stepTitle}>Importing Data</Text>
        <Text style={styles.stepDescription}>
          Please wait while we import your backup data
        </Text>
      </View>

      <View style={styles.progressCard}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${processingProgress}%` }]} />
        </View>
        <Text style={styles.progressText}>{processingMessage}</Text>
        <Text style={styles.progressPercentage}>{Math.round(processingProgress)}%</Text>
      </View>

      <View style={styles.importWarning}>
        <Ionicons name="information-circle" size={20} color="#F59E0B" />
        <Text style={styles.importWarningText}>
          Please don't close the app or navigate away during the import process.
        </Text>
      </View>
    </View>
  );

  const renderCompleteStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Ionicons name="checkmark-circle" size={48} color="#10B981" />
        <Text style={styles.stepTitle}>Import Complete!</Text>
        <Text style={styles.stepDescription}>
          Your data has been successfully imported
        </Text>
      </View>

      {importResult && (
        <View style={styles.successCard}>
          <Text style={styles.successTitle}>Import Summary</Text>
          
          <View style={styles.successRow}>
            <Ionicons name="library" size={20} color="#10B981" />
            <Text style={styles.successText}>
              {importResult.books} books imported
            </Text>
          </View>
          
          <View style={styles.successRow}>
            <Ionicons name="time" size={20} color="#10B981" />
            <Text style={styles.successText}>
              {importResult.sessions} reading sessions imported
            </Text>
          </View>
        </View>
      )}

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={handleClose}
      >
        <Text style={styles.primaryButtonText}>Done</Text>
      </TouchableOpacity>
    </View>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'select':
        return renderSelectStep();
      case 'validate':
        return renderValidateStep();
      case 'configure':
        return renderConfigureStep();
      case 'import':
        return renderImportStep();
      case 'complete':
        return renderCompleteStep();
      default:
        return renderSelectStep();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={handleClose} 
            style={styles.closeButton}
            disabled={isProcessing}
          >
            <Ionicons name="close" size={24} color="#6C63FF" />
          </TouchableOpacity>
          <Text style={styles.title}>Import Data</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {renderCurrentStep()}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  closeButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  stepContainer: {
    paddingVertical: 24,
  },
  stepHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  stepDescription: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  instructionsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  instructionText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 12,
  },
  backupInfoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  backupInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '600',
  },
  warningCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  warningContent: {
    marginLeft: 12,
    flex: 1,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
  },
  optionsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  optionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    marginBottom: 12,
  },
  optionButtonSelected: {
    borderColor: '#6C63FF',
    backgroundColor: '#F8FAFF',
  },
  optionContent: {
    flex: 1,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 8,
  },
  optionTitleSelected: {
    color: '#6C63FF',
  },
  optionDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  radioButtonSelected: {
    borderColor: '#6C63FF',
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#6C63FF',
  },
  dangerCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  dangerText: {
    fontSize: 14,
    color: '#DC2626',
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
  progressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6C63FF',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 8,
  },
  progressPercentage: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  importWarning: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  importWarningText: {
    fontSize: 14,
    color: '#92400E',
    marginLeft: 12,
    flex: 1,
  },
  successCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#166534',
    marginBottom: 16,
  },
  successRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  successText: {
    fontSize: 14,
    color: '#166534',
    marginLeft: 12,
    fontWeight: '500',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#6C63FF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  disabledButton: {
    backgroundColor: '#9CA3AF',
  },
});