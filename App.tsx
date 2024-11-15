import React, { useState } from "react";
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  Text,
  Modal,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";
import { format, isBefore, startOfDay } from "date-fns";
import { Trash, Send, X, Users, AlertCircle } from "lucide-react-native";

// Types
type FormErrors = {
  title?: string;
  meetingDate?: string;
  timeFrom?: string;
  timeTo?: string;
  participants?: string;
  selectedRoom?: string;
};

type Room = {
  id: string;
  name: string;
  capacity: number;
};

type RoomElement = {
  label: string;
  value: string;
};

// Components
const ErrorMessage = ({ message }: { message?: string }) => {
  if (!message) return null;
  return (
    <View style={styles.errorContainer}>
      <AlertCircle size={16} color="#dc2626" />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
};

const ParticipantModal = ({
  visible,
  onClose,
  participants,
  onRemoveParticipant,
}: {
  visible: boolean;
  onClose: () => void;
  participants: string[];
  onRemoveParticipant: (email: string) => void;
}) => (
  <Modal
    animationType="slide"
    transparent={true}
    visible={visible}
    onRequestClose={onClose}
  >
    <View style={styles.modalOverlay}>
      <View style={styles.modalView}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Participants</Text>
          <TouchableOpacity onPress={onClose} style={styles.iconButton}>
            <X size={24} color="grey" />
          </TouchableOpacity>
        </View>

        <ScrollView>
          {participants.length === 0 ? (
            <Text style={styles.noParticipantsText}>
              No participants added yet
            </Text>
          ) : (
            participants.map((participant, index) => (
              <View key={index} style={styles.modalParticipantItem}>
                <Text style={styles.modalParticipantEmail}>{participant}</Text>
                <TouchableOpacity
                  onPress={() => onRemoveParticipant(participant)}
                  style={styles.iconButton}
                >
                  <Trash size={20} color="grey" />
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </View>
  </Modal>
);

export default function App() {
  // State
  const [modalVisible, setModalVisible] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState(new Date());
  const [timeFrom, setTimeFrom] = useState(new Date());
  const [timeTo, setTimeTo] = useState(new Date());
  const [description, setDescription] = useState("");
  const [participants, setParticipants] = useState<string[]>([]);
  const [newParticipant, setNewParticipant] = useState("");
  const [selectedRoom, setSelectedRoom] = useState("");
  const [rooms, setRooms] = useState<RoomElement[]>([]);

  // API calls
  const checkAvailableRoom = async (capacity: number) => {
    const params = new URLSearchParams({
      capacity: capacity.toString(),
      date: format(meetingDate, "yyyy-MM-dd"),
      timeFrom: format(timeFrom, "HH:mm"),
      timeTo: format(timeTo, "HH:mm"),
    });

    try {
      const response = await fetch(
        `http://localhost:3000/api/schedule?${params}`
      );
      const data = await response.json();
      setRooms(
        data.rooms.map((room: Room) => ({
          label: room.name,
          value: room.id,
        }))
      );
    } catch (error) {
      Alert.alert("Error", "Failed to fetch available rooms");
    }
  };

  // Form handlers
  const handleAddParticipant = () => {
    if (newParticipant.trim()) {
      const updatedParticipants = [...participants, newParticipant.trim()];
      setParticipants(updatedParticipants);
      setNewParticipant("");
      checkAvailableRoom(updatedParticipants.length);
    }
  };

  const handleRemoveParticipant = (email: string) => {
    const updatedParticipants = participants.filter((p) => p !== email);
    setParticipants(updatedParticipants);
    checkAvailableRoom(updatedParticipants.length);
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!title?.trim()) newErrors.title = "Title is required";
    if (isBefore(meetingDate, startOfDay(new Date()))) {
      newErrors.meetingDate = "Meeting date cannot be in the past";
    }
    if (isBefore(timeTo, timeFrom)) {
      newErrors.timeTo = "End time cannot be before start time";
    }
    if (participants.length === 0) {
      newErrors.participants = "At least one participant is required";
    }
    if (!selectedRoom) newErrors.selectedRoom = "Please select a meeting room";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    if (!validateForm()) {
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch("http://localhost:3000/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          date: format(meetingDate, "yyyy-MM-dd"),
          timeFrom: format(timeFrom, "HH:mm"),
          timeTo: format(timeTo, "HH:mm"),
          description,
          guests: participants,
          roomId: selectedRoom,
        }),
      });

      await response.json();
      Alert.alert("Success", "Meeting has been scheduled successfully");
    } catch (error) {
      Alert.alert("Error", "Failed to schedule meeting. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Time/Date change handlers
  const onChangeDate = (selectedDate?: Date) => {
    if (selectedDate) {
      setMeetingDate(selectedDate);
      checkAvailableRoom(participants.length);
    }
  };

  const onChangeFromTime = (selectedTime?: Date) => {
    if (selectedTime) {
      setTimeFrom(selectedTime);
      setErrors((prev) => ({
        ...prev,
        timeFrom: undefined,
        timeTo: undefined,
      }));
      checkAvailableRoom(participants.length);
    }
  };

  const onChangeToTime = (selectedTime?: Date) => {
    if (selectedTime) {
      setTimeTo(selectedTime);
      setErrors((prev) => ({
        ...prev,
        timeTo: selectedTime < timeFrom ? "End time cannot be before start time" : undefined,
      }));
      checkAvailableRoom(participants.length);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex1}
      >
        <View style={styles.header}>
          <Text style={styles.headerText}>Create Meeting Invite</Text>
          <TouchableOpacity
            onPress={handleSubmit}
            style={[styles.iconButton, isSubmitting && styles.disabled]}
            disabled={isSubmitting}
          >
            <Send size={16} color={isSubmitting ? "#9ca3af" : "grey"} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.flex1}
          contentContainerStyle={styles.formPadding}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.formContainer}>
            <View>
              <TextInput
                style={[styles.input, errors.title && styles.inputError]}
                placeholder="Title"
                value={title}
                onChangeText={(text) => {
                  setTitle(text);
                  if (errors.title) {
                    setErrors((prev) => ({ ...prev, title: undefined }));
                  }
                }}
              />
              <ErrorMessage message={errors.title} />
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>Meeting Date</Text>
              <DateTimePicker
                style={styles.flex1}
                testID="datePicker"
                minimumDate={new Date()}
                value={meetingDate}
                mode="date"
                onChange={(_, date) => onChangeDate(date)}
              />
              <ErrorMessage message={errors.meetingDate} />
            </View>

            <View style={styles.timeContainer}>
              <View style={styles.timeGroup}>
                <Text style={styles.label}>From</Text>
                <DateTimePicker
                  style={styles.flex1}
                  testID="fromTimePicker"
                  value={timeFrom}
                  mode="time"
                  onChange={(_, time) => onChangeFromTime(time)}
                />
              </View>

              <View style={styles.timeGroup}>
                <Text style={[styles.label, styles.textCenter]}>To</Text>
                <DateTimePicker
                  style={styles.flex1}
                  value={timeTo}
                  mode="time"
                  onChange={(_, time) => onChangeToTime(time)}
                />
              </View>
            </View>
            <ErrorMessage message={errors.timeTo} />

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Description"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
            />

            <View style={styles.participantsContainer}>
              <Text style={styles.participantLabel}>Participants</Text>
              <View style={styles.row}>
                <TextInput
                  style={[styles.input, styles.flex1]}
                  placeholder="Add Participant Email"
                  value={newParticipant}
                  onChangeText={setNewParticipant}
                  onSubmitEditing={handleAddParticipant}
                  returnKeyType="done"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={styles.viewParticipantsButton}
                  onPress={() => setModalVisible(true)}
                >
                  <Users size={20} color="black" />
                  <Text style={styles.buttonText}>
                    View ({participants.length})
                  </Text>
                </TouchableOpacity>
              </View>
              <ErrorMessage message={errors.participants} />
            </View>

            <View>
              <Picker
                style={styles.picker}
                selectedValue={selectedRoom}
                onValueChange={(itemValue) => {
                  setSelectedRoom(itemValue);
                  if (errors.selectedRoom) {
                    setErrors((prev) => ({ ...prev, selectedRoom: undefined }));
                  }
                }}
              >
                <Picker.Item label="Select Meeting Room" value="" />
                {rooms.map((room) => (
                  <Picker.Item
                    key={room.value}
                    label={room.label}
                    value={room.value}
                  />
                ))}
              </Picker>
              <ErrorMessage message={errors.selectedRoom} />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && styles.disabled]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              <Text style={styles.submitButtonText}>Submit</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <ParticipantModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          participants={participants}
          onRemoveParticipant={handleRemoveParticipant}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
    
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  flex1: {
    flex: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  textCenter: {
    textAlign: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#dee2e6",
  },
  headerText: {
    fontSize: 20,
    fontWeight: "600",
  },
  formPadding: {
    padding: 5,
  },
  formContainer: {
    padding: 20,
    gap: 15,
  },
  input: {
    height: 40,
    borderColor: "gray",
    borderWidth: 1,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  inputError: {
    borderColor: "#dc2626",
    borderWidth: 1,
  },
  textArea: {
    height: 120,
    textAlignVertical: "top",
    paddingTop: 10,
  },
  label: {
    fontSize: 16,
    minWidth: 60,
  },
  timeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 20,
  },
  timeGroup: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 10,
  },
  picker: {
    marginVertical: 5,
  },
  participantsContainer: {
    gap: 8,
  },
  participantLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
  },
  viewParticipantsButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    backgroundColor: "#e5e7eb",
    borderRadius: 8,
    gap: 5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalView: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
  },
  modalParticipantItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
  },
  modalParticipantEmail: {
    fontSize: 16,
    flex: 1,
  },
  noParticipantsText: {
    textAlign: "center",
    color: "#666",
    marginTop: 20,
    fontSize: 16,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 4,
  },
  errorText: {
    color: "#dc2626",
    fontSize: 12,
  },
  iconButton: {
    padding: 8,
    borderRadius: 8,
  },
  submitButton: {
    backgroundColor: "#1C1917",
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 8,
    marginTop: 20,
  },
  submitButtonText: {
    color: "#FAFAF9",
    fontWeight: "bold",
    fontSize: 16,
  },
  buttonText: {
    fontWeight: "500",
  },
  disabled: {
    opacity: 0.5,
  },
});